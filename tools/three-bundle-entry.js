import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
const THREE = Object.assign({}, THREE_NS, { GLTFLoader, SkeletonUtils });
window.THREE = THREE;
