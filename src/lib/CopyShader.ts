/**
 * @module CopyShader
 * @three_import import { CopyShader } from 'three/addons/shaders/CopyShader.js';
 */

import * as THREE from 'three';

interface CopyShaderUniforms {
    [key: string]: THREE.IUniform<any>;
    tDiffuse: THREE.IUniform<THREE.Texture | null>;
    opacity: THREE.IUniform<number>;
}

interface ShaderDefinition {
    name: string;
    uniforms: CopyShaderUniforms;
    vertexShader: string;
    fragmentShader: string;
}

/**
 * Full-screen copy shader pass.
 *
 * @constant
 * @type {ShaderDefinition}
 */
export const CopyShader: ShaderDefinition = {

    name: 'CopyShader',

    uniforms: {
        'tDiffuse': { value: null },
        'opacity': { value: 1.0 }
    },

    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`

        uniform float opacity;

        uniform sampler2D tDiffuse;

        varying vec2 vUv;

        void main() {

            vec4 texel = texture2D( tDiffuse, vUv );
            gl_FragColor = opacity * texel;


        }`

};