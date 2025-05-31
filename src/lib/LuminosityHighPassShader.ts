import {
    Color,
    IUniform,
    Texture
} from 'three';

/**
 * @module LuminosityHighPassShader
 * @three_import import { LuminosityHighPassShader } from 'three/addons/shaders/LuminosityHighPassShader.js';
 */

interface LuminosityHighPassShaderUniforms {
    [key: string]: IUniform<any>;
    tDiffuse: IUniform<Texture | null>;
    luminosityThreshold: IUniform<number>;
    smoothWidth: IUniform<number>;
    defaultColor: IUniform<Color>;
    defaultOpacity: IUniform<number>;
}

interface ShaderDefinition {
    name: string;
    uniforms: LuminosityHighPassShaderUniforms;
    vertexShader: string;
    fragmentShader: string;
}

/**
 * Luminosity high pass shader.
 *
 * @constant
 * @type {ShaderDefinition}
 */
export const LuminosityHighPassShader: ShaderDefinition = {

    name: 'LuminosityHighPassShader',

    uniforms: {
        'tDiffuse': { value: null },
        'luminosityThreshold': { value: 1.0 },
        'smoothWidth': { value: 1.0 },
        'defaultColor': { value: new Color(0x000000) },
        'defaultOpacity': { value: 0.0 }
    },

    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;

            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`

        uniform sampler2D tDiffuse;
        uniform vec3 defaultColor;
        uniform float defaultOpacity;
        uniform float luminosityThreshold;
        uniform float smoothWidth;

        varying vec2 vUv;

        void main() {

            vec4 texel = texture2D( tDiffuse, vUv );

            float v = luminance( texel.xyz );

            vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

            float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

            gl_FragColor = mix( outputColor, texel, alpha );

        }`

};