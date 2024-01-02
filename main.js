'use strict';

let gl;                         // The webgl context.
let surface, surface2;                    // A surface model.
let shProgram;                  // A shader program.
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let xx, yy, zz = 0;
let coords = [0, 0]


// Degree-to-Radian conversion
function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTexBuffer = gl.createBuffer();
    this.vertices = 0;
    this.count = 0;

    this.BufferData = function (vertices, texs) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texs), gl.STREAM_DRAW);
        this.vertices = vertices;
        this.count = vertices.length / 3;
    }

    this.Draw = function () {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTex, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTex);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
    }
}


// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function () {
        gl.useProgram(this.prog);
    }
}


// Draws a colored Kiss Surface, along with a set of coordinate axes.
function draw() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

    let modelViewInv = m4.inverse(matAccum1, new Float32Array(16));
    let normalMatrix = m4.transpose(modelViewInv, new Float32Array(16));

    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.uniform3fv(shProgram.iLightPosition, [xx = Math.sin(Date.now() * 0.001), yy = 2 * Math.cos(Date.now() * 0.001), zz]);
    gl.uniform2fv(shProgram.iCoords, coords);
    gl.uniform1f(shProgram.iScale, 5-document.getElementById('scale').value);

    surface.Draw();
    zz = mapRange(coords[1], 0, 1, -500, 500) / 500;
    xx = zz * zz * Math.sqrt(1 - zz) * Math.cos(mapRange(coords[0], 0, 1, 0, Math.PI * 2));
    yy = zz * zz * Math.sqrt(1 - zz) * Math.sin(mapRange(coords[0], 0, 1, 0, Math.PI * 2));
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, m4.multiply(modelViewProjection,
        m4.translation(xx, yy, zz)));
    gl.uniform1i(shProgram.ilight, true);
    surface2.Draw();
    gl.uniform1i(shProgram.ilight, false);
}

function draw2() {
    draw()
    window.requestAnimationFrame(draw2)
}

/*
    Creates surface data for a Kiss Surface using parametric equations.
    Returns an array containing vertex data.
 */
function CreateSurfaceData() {
    let vertexList = [];
    let textureList = [];
    let x, y, z, x1, y1, z1, u1;
    let zScale = 500;
    let zStep = 1 / zScale;
    let uStep = 0.5;

    //  Loop through values to create coordinates.
    for (let u = 0; u <= 360; u += uStep) {
        for (let z0 = -1 * zScale; z0 <= zScale; z0 += 1) {

            // Calculate x, y, and z coordinates based on parametric equations.
            z = z0 / zScale;
            x = z * z * Math.sqrt(1 - z) * Math.cos(deg2rad(u));
            y = z * z * Math.sqrt(1 - z) * Math.sin(deg2rad(u));
            vertexList.push(x, y, z);
            textureList.push(u / 360, mapRange(z, -1, 1, 0, 1))

            z1 = z + zStep;
            u1 = u + uStep;
            x1 = z1 * z1 * Math.sqrt(1 - z1) * Math.cos(deg2rad(u1));
            y1 = z1 * z1 * Math.sqrt(1 - z1) * Math.sin(deg2rad(u1));
            vertexList.push(x1, y1, z1);
            textureList.push(u1 / 360, mapRange(z1, -1, 1, 0, 1))
        }
    }

    // Return the array containing the vertex data for the 3D surface.
    return [vertexList, textureList];
}

// linearly maps value from the range (a..b) to (c..d)
function mapRange(value, a, b, c, d) {
    // first map value from (a..b) to (0..1)
    value = (value - a) / (b - a);
    // then map it from (0..1) to (c..d) and return it
    return c + value * (d - c);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTex = gl.getAttribLocation(prog, "texture");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "normalMatrix");
    shProgram.ilight = gl.getUniformLocation(prog, "light");
    shProgram.iScale = gl.getUniformLocation(prog, "scale");
    shProgram.iCoords = gl.getUniformLocation(prog, "coords");

    surface = new Model('Surface');
    surface.BufferData(...CreateSurfaceData());
    surface2 = new Model('Surface');
    surface2.BufferData(CreateSphere(), CreateSphere());

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 identifier for that program.  If an error occurs while compiling or
 linking the program, an exception of type Error is thrown.  The error 
 string contains the compilation or linking error.  If no error occurs,
 the program identifier is the return value of the function.
 The second and third parameters are strings that contain the
 source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * Initialization of a function that will be called when the page has loaded.
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        LoadTexture()
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    let xInput = document.getElementById("x");
    let yInput = document.getElementById("y");
    let zInput = document.getElementById("z");

    const updateLight = () => {
        let x = parseFloat(xInput.value);
        let y = parseFloat(yInput.value);
        let z = parseFloat(zInput.value);
        xx = x;
        yy = y;
        zz = z;
        console.log(x, y, z);

        gl.uniform3fv(shProgram.iLightPosition, [x, y, z]);
        draw();
    };

    xInput.addEventListener("input", updateLight);
    yInput.addEventListener("input", updateLight);
    zInput.addEventListener("input", updateLight);

    draw2();
}

function LoadTexture() {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const image = new Image();
    image.crossOrigin = 'anonymus';
    image.src = "https://raw.githubusercontent.com/tasvyk/vogagi/CGW/metallic_rock.png";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        console.log("imageLoaded")
        draw()
    }
}


function CreateSphere() {
    let vertexList = [];

    let u = 0,
        t = 0;
    while (u < Math.PI * 2) {
        while (t < Math.PI) {
            let v = sphVert(u, t);
            let w = sphVert(u + 0.1, t);
            let wv = sphVert(u, t + 0.1);
            let ww = sphVert(u + 0.1, t + 0.1);
            vertexList.push(v.x, v.y, v.z);
            vertexList.push(w.x, w.y, w.z);
            vertexList.push(wv.x, wv.y, wv.z);
            vertexList.push(wv.x, wv.y, wv.z);
            vertexList.push(w.x, w.y, w.z);
            vertexList.push(ww.x, ww.y, ww.z);
            t += 0.1;
        }
        t = 0;
        u += 0.1;
    }
    return vertexList;
}
const radius = 0.1;
function sphVert(long, lat) {
    return {
        x: radius * Math.cos(long) * Math.sin(lat),
        y: radius * Math.sin(long) * Math.sin(lat),
        z: radius * Math.cos(lat)
    }
}

window.onkeydown = (e) => {
    if (e.keyCode == 87) {
        coords[0] = Math.min(coords[0] + 0.01, 1);
    }
    else if (e.keyCode == 83) {
        coords[0] = Math.max(coords[0] - 0.01, 0);
    }
    else if (e.keyCode == 68) {
        coords[1] = Math.min(coords[1] + 0.01, 1);
    }
    else if (e.keyCode == 65) {
        coords[1] = Math.max(coords[1] - 0.01, 0);
    }
}
