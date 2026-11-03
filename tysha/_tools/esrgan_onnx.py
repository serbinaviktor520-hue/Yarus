#!/usr/bin/env python3
"""Real-ESRGAN (compact "general x4v3") without PyTorch: the weights are read from the .pth zip with a small unpickler,
the network (SRVGGNetCompact: 34 conv + PReLU layers, a 4x pixel shuffle, plus the nearest-upsampled input) is written as
an ONNX graph and run with onnxruntime on the CPU, in tiles.

    pip install onnx onnxruntime
    curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
    curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth
    python3 tysha/_tools/esrgan_onnx.py realesr-general-x4v3.pth realesr-general-wdn-x4v3.pth x4.onnx --denoise 0.3
    python3 tysha/_tools/grade.py --raw /path/to/raw --sr x4.onnx h08 g16w p01

--denoise mixes the two weight sets the way Real-ESRGAN's own "denoise strength" does: 1 = smooth (paints stone and
grain away), 0 = keeps the render's noise. 0.3 keeps travertine looking like stone. grade.py blends the result with a
Lanczos upscale and keeps Lanczos alone on small people, whose faces the model paints.
"""
import collections, pickle, sys, zipfile
import numpy as np


def load_pth(path):
    z = zipfile.ZipFile(path)
    root = z.namelist()[0].split('/')[0]
    types = {'FloatStorage': np.float32, 'HalfStorage': np.float16}

    class Storage:
        def __init__(self, kind, key):
            self.dt, self.key = types[kind], key

    def rebuild(st, offset, size, stride, *_):
        buf = np.frombuffer(z.read(f'{root}/data/{st.key}'), dtype=st.dt)
        return np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=[x * buf.itemsize for x in stride]).astype(np.float32)

    class Unpickler(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == '_rebuild_tensor_v2':
                return rebuild
            if name == 'OrderedDict':
                return collections.OrderedDict
            if mod.startswith('torch') and name.endswith('Storage'):
                return name
            return super().find_class(mod, name)

        def persistent_load(self, pid):
            kind = pid[1] if isinstance(pid[1], str) else pid[1].__name__
            return Storage(kind, pid[2])

    sd = Unpickler(z.open(f'{root}/data.pkl')).load()
    return sd.get('params', sd)


def build(sd, out):
    import onnx
    from onnx import helper, numpy_helper, TensorProto
    nodes, inits, x = [], [], 'input'
    for n in sorted({int(k.split('.')[1]) for k in sd}):
        w = sd[f'body.{n}.weight']
        if w.ndim == 4:
            inits += [numpy_helper.from_array(w, f'w{n}'), numpy_helper.from_array(sd[f'body.{n}.bias'], f'b{n}')]
            nodes.append(helper.make_node('Conv', [x, f'w{n}', f'b{n}'], [f'c{n}'], pads=[1, 1, 1, 1])); x = f'c{n}'
        else:
            inits.append(numpy_helper.from_array(w.reshape(1, -1, 1, 1), f'a{n}'))
            nodes.append(helper.make_node('PRelu', [x, f'a{n}'], [f'p{n}'])); x = f'p{n}'
    nodes.append(helper.make_node('DepthToSpace', [x], ['up'], blocksize=4, mode='CRD'))
    inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), 'sc'))
    nodes.append(helper.make_node('Resize', ['input', '', 'sc'], ['base'], mode='nearest'))
    nodes.append(helper.make_node('Add', ['up', 'base'], ['output']))
    io = lambda n: helper.make_tensor_value_info(n, TensorProto.FLOAT, [1, 3, None, None])
    m = helper.make_model(helper.make_graph(nodes, 'srvgg', [io('input')], [io('output')], inits), opset_imports=[helper.make_opsetid('', 13)])
    m.ir_version = 8
    onnx.save(m, out)


def upscale4(img, model, tile=192, pad=12):
    """PIL image -> PIL image at 4x, in overlapping tiles (memory stays small)."""
    import onnxruntime as ort
    from PIL import Image
    so = ort.SessionOptions()
    s = ort.InferenceSession(model, so, providers=['CPUExecutionProvider'])
    a = np.asarray(img.convert('RGB'), np.float32) / 255
    H, W, _ = a.shape
    out = np.zeros((H * 4, W * 4, 3), np.float32)
    for y in range(0, H, tile):
        for x in range(0, W, tile):
            y0, x0, y1, x1 = max(0, y - pad), max(0, x - pad), min(H, y + tile + pad), min(W, x + tile + pad)
            r = s.run(None, {'input': a[y0:y1, x0:x1].transpose(2, 0, 1)[None]})[0][0].transpose(1, 2, 0)
            th, tw = min(tile, H - y) * 4, min(tile, W - x) * 4
            out[y * 4:y * 4 + th, x * 4:x * 4 + tw] = r[(y - y0) * 4:(y - y0) * 4 + th, (x - x0) * 4:(x - x0) * 4 + tw]
    return Image.fromarray(np.uint8(np.clip(out, 0, 1) * 255 + 0.5))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('pth'); ap.add_argument('wdn'); ap.add_argument('out')
    ap.add_argument('--denoise', type=float, default=0.3)
    o = ap.parse_args()
    a, b = load_pth(o.pth), load_pth(o.wdn)
    build({k: o.denoise * a[k] + (1 - o.denoise) * b[k] for k in a}, o.out)
    print('wrote', o.out)
