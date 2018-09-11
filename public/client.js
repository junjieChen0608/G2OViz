/******************************************* client-side **************************************************/
console.log('client running');

var verticesFromBackend;
const vertexBatchSize = 5000;
const edgeBatchSize = 20000;
var totalIteration = 0;
var totalVertex = 0;
var totalEdgeDrawn = 0;


const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	counter = 0;
	console.log('button clicked');
	var graphName = document.getElementById('graphName').value;
	if (graphName[0] == '/') {
		graphName = replaceSlash(graphName);
	}

	var selectedPose = document.getElementById('selectedPose').value;
    console.log("selected pose: " + selectedPose);
    if (selectedPose !== "") {
        countVertex(graphName, selectedPose);
    } else {
        mainDiv.innerHTML = "Please select a pose";
    }
});

// enable press enter to query
const input = document.getElementById('graphName');
input.addEventListener('keyup', function(event) {
	event.preventDefault();

	if (event.keyCode === 13) {
		button.click();
	}
});

// count total number of edges in given graph
function countEdge(graphName) {
	console.log('count edges in graph ' + graphName);

	fetch('/countEdge/' + graphName, {method: 'GET'})
	.then(function(response) {
		if (response.ok) {
			console.log('count edges successful');
			return response.json();
		}
		throw new Error('count edges failed');
	})
	.then(function(responseJSON) {
		console.log("total edges " + JSON.stringify(responseJSON));
        queryGraphEdge(graphName, edgeBatchSize, 0);
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = "count edges failed";
		console.log(err);
	});
}

// query the given graph to count total vertices
function countVertex(graphName, selectedPose) {
	console.log('count graph ' + graphName);
    totalEdgeDrawn = 0;
	fetch('/countVertex/' + graphName, {method: 'GET'})
	.then(function(response) {
		if (response.ok) {
			console.log('count vertex successful');
			return response.json();
		}
		throw new Error('count vertex failed');
	})
	.then(function(responseJSON) {
		// document.getElementById('mainDiv').innerHTML = JSON.stringify(responseJSON);
		totalVertex = JSON.stringify(responseJSON);
		console.log("total vertex " + totalVertex);
		
		totalIteration = Math.floor(totalVertex / vertexBatchSize) + ((totalVertex % vertexBatchSize) ? 1 : 0);
		console.log("need to iterate " + totalIteration);
		
		// query the graph in a loop
		if (totalVertex > 0) {
			init();
			animate();
			queryGraphVertex(graphName, selectedPose, vertexBatchSize, 0);
		} else {
			throw new Error('count vertex failed');		
		}
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
}

// query given graph, response is a batch size of vertices
function queryGraphVertex(graphName, selectedPose, vertexBatchSize, iteration) {
	fetch('/queryGraphVertex/'
          + graphName + '/'
          + selectedPose + '/'
          + vertexBatchSize + '/'
          + iteration, {method: 'GET'})
	.then(function(response) {
		if (response.ok) {
			console.log('query graph vertices successful');
			return response.json();
		}
		throw new Error('query graph vertices failed');
	})
	.then(function(responseJSON) {
		console.log("draw vertices from back-end");

		verticesFromBackend = JSON.parse(JSON.stringify(responseJSON));
		console.log("back-end vertex length " + Object.keys(verticesFromBackend).length);

		for (var vid in verticesFromBackend) {
		    var curVertex = verticesFromBackend[vid];
            drawVertex(vid, curVertex["ori"], curVertex["pos"]);
        }

		// merge all drawn vertex geometries to render a single mesh
		if (vertexGeometriesDrawn.length) {
			var mergedVertexObjects = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(vertexGeometriesDrawn), defaultMaterial);
			scene.add(mergedVertexObjects);
		}
		vertexGeometriesDrawn = [];

		if (++iteration < totalIteration) {
			// recursive call, query next batch of vertex
			queryGraphVertex(graphName, selectedPose, vertexBatchSize, iteration);
		} else {
			// query is finished, update both page and console
			document.getElementById('mainDiv').innerHTML = "done";

			// pickingScene.add( new THREE.Mesh( THREE.BufferGeometryUtils.mergeBufferGeometries( vertexGeometriesPicking ), pickingMaterial ) );			
            console.log("draw vertices from back-end DONE");
			// query edge count of given graph
			countEdge(graphName);
		}
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
}

// query given graph's edges batch by batch, then draw them
function queryGraphEdge(graphName, edgeBatchSize, index) {
    fetch('/queryGraphEdge/' + graphName + '/' + edgeBatchSize + '/' + index, {method: 'GET'})
    .then(function(response) {
        if (response.ok) {
            console.log('query graph edges successful');
            return response.json();
        }
        throw new Error('query graph edges failed');
    })
    .then(function(responseJSON) {
        var edgesFromBackend = JSON.parse(JSON.stringify(responseJSON));
        var backEndIndex = edgesFromBackend["index"];
        var backEndEdgeCount = edgesFromBackend["edgeCount"];
        // console.log("backend index: " + backEndIndex
        //             + "\nbackend edge count " + backEndEdgeCount);
        totalEdgeDrawn += backEndEdgeCount;
        // var head = edgesFromBackend["edges"][0]["fromPos"];
        // console.log(head[0]);

        var edgeArray = edgesFromBackend["edges"];
        for (var i  = 0; i < edgeArray.length; ++i) {
            var fromPos = edgeArray[i]["fromPos"];
            var toPos = edgeArray[i]["toPos"];
            drawEdge(fromPos, toPos);
        }

        // merge all drawn edge geometries to render a single line segment
        if (edgeGeometriesDrawn.length) {
        	var mergedEdgeObject = new THREE.LineSegments(THREE.BufferGeometryUtils.mergeBufferGeometries(edgeGeometriesDrawn), lineMaterial);
        	scene.add(mergedEdgeObject);
        }
        edgeGeometriesDrawn = [];

        if (backEndIndex < totalVertex) {
            console.log("draw edges from back-end");
            queryGraphEdge(graphName, edgeBatchSize, ++backEndIndex);
        } else {
            console.log("draw edges from back-end DONE"
                        + "\ntotal " + totalEdgeDrawn + " drawn");
            console.log("\n****************************************\n");
        }

    })
    .catch(function(err) {
        console.log(err);
    });
}

// replace slash to %2F in the query url
function replaceSlash(input) {
	console.log("replacing slash for " + input);
	return input.replace(/\//g, '%2F');
}

// draw line segment
function drawEdge(fromPos, toPos) {
	var points = [
		fromPos[0], fromPos[1], fromPos[2],
		toPos[0], toPos[1], toPos[2],
	];

	var edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
	edgeGeometriesDrawn.push(edgeGeometry);
}

// handle poses JSON
function drawVertex(vid, ori, pos) {
    // console.log("vid " + vid
    //             + "\nori: " + ori[0]
    //             + "\npos: " + pos[0]);

    var geometry = new THREE.ConeBufferGeometry(0.5, 1, 8, 1, false, 0, 6.3);

    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var quaternion = new THREE.Quaternion(ori[1], ori[2], ori[3], ori[0]);
    var rotation = new THREE.Euler().setFromQuaternion(quaternion);

    matrix.compose(position, quaternion, scale);
    geometry.applyMatrix(matrix);
    // give the geometry's vertices color
    applyVertexColors(geometry, color.setHex(colorVertex));
    vertexGeometriesDrawn.push(geometry);

    // the rest of this section servers the pick function
    geometry = geometry.clone();
    // give the geometry's vertices a color corresponding to the id
    applyVertexColors(geometry, color.setHex(universalCounter));

    // vertexGeometriesPicking.push(geometry);

    // pickingData[universalCounter] = {
    // 	position: position,
    // 	rotation: rotation,
    // 	vid: vid
    // };
    ++universalCounter;
}

/******************************************* three.js **************************************************/
var container, stats;
var camera, controls, scene, renderer, light;
var pickingData = [], pickingTexture, pickingScene;
var highlightBox;
var raycaster;
var currentIntersected;

var pickingMaterial;
var defaultMaterial;
var lineMaterial;

var vertexGeometriesDrawn = [];
var vertexGeometriesPicking = [];
var edgeGeometriesDrawn = [];

var verticesDrawn = {};
var oweEdges = {};

var mouse = new THREE.Vector2();
var rayTracer = new THREE.Vector2();

var color = new THREE.Color();
const colorVertex = 0x135cd3;
const colorEdge = 0x7f0026;
const colorOnSelect = 0xefdc04;

const scale = new THREE.Vector3(0.7, 0.7, 0.7);

var universalCounter = 0;

// render the scene batch by batch
// init();
// animate();

function init() {
	vertexGeometriesDrawn = [];
	vertexGeometriesPicking = [];
	pickingData = [];
	edgeGeometriesDrawn = [];
	initInvariants();
}

function initControls() {
	controls = new THREE.TrackballControls(camera, renderer.domElement);
	controls.rotateSpeed = 1.0;
	controls.zoomSpeed = 1.2;
	controls.panSpeed = 0.8;
	controls.noZoom = false;
	controls.noPan = false;
	controls.staticMoving = true;
	controls.dynamicDampingFactor = 0.3;
}

function initInvariants() {
	container = document.getElementById( "container" );

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100000);
	camera.position.z = 2000;

	pickingScene = new THREE.Scene();
	pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
	pickingTexture.texture.minFilter = THREE.LinearFilter;

	pickingMaterial = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );
	defaultMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0	} );
	lineMaterial = new THREE.LineBasicMaterial({color: colorEdge});
	
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xd8d8d8);
	scene.add(new THREE.AmbientLight(0x555555));

	scene.add( new THREE.AmbientLight( 0x555555 ) );
	light = new THREE.SpotLight(0xffffff, 1.5);
	light.position.set(10000, 10000, 10000);
	scene.add(light);

	highlightBox = new THREE.Mesh(new THREE.ConeBufferGeometry(1.5, 5.5, 8, 1, false, 0, 6.3),
								  new THREE.MeshLambertMaterial( { color: 0xffff00 }));
	scene.add(highlightBox);
	
	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	renderer = new THREE.WebGLRenderer( { antialias: false } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	stats = new Stats();
	container.appendChild( stats.dom );

	renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
	initControls();
}

function onDocumentMouseMove(event) {

	// event.preventDefault();
	rayTracer.x = ( event.offsetX / window.innerWidth ) * 2 - 1;
	rayTracer.y = - ( event.offsetY / window.innerHeight ) * 2 + 1;

	mouse.x = event.offsetX;
	mouse.y = event.offsetY;
}

// animate loop, render the scene
function animate() {
	requestAnimationFrame( animate );
	render();
	stats.update();
}

function render() {
	controls.update();
	pick();
	renderer.render( scene, camera );
}

function highlight() {

	raycaster.setFromCamera(rayTracer, camera);

	var intersects = raycaster.intersectObjects(edgeGeometriesDrawn);

	// intersected
	if ( intersects.length > 0 ) {
		
		// something is intersected previously, need to reset
		if (currentIntersected !== undefined &&
			intersects[0].object !== currentIntersected) {
			resetPrevIntersect(currentIntersected);
		}

		currentIntersected = intersects[0].object;
		highlightIntersect();

	} else {
		// not intersected, need to reset state if something is intersected previously
		if (currentIntersected !== undefined) {
			resetPrevIntersect();
		}
		currentIntersected = undefined;
	}
}

// highlight intersected element
function highlightIntersect() {
	currentIntersected.material.linewidth = 5;
	scene.add(currentIntersected);
}

// reset previously highlighted element
function resetPrevIntersect() {
	currentIntersected.material.linewidth = 1;
	scene.remove(currentIntersected);
}

function applyVertexColors( geometry, color ) {

	var position = geometry.attributes.position;
	var colors = [];

	for ( var i = 0; i < position.count; i ++ ) {
		colors.push( color.r, color.g, color.b );
	}

	geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

}

function pick() {
	//render the picking scene off-screen
	renderer.render( pickingScene, camera, pickingTexture );

	//create buffer for reading single pixel

	var pixelBuffer = new Uint8Array( 4 );

	//read the pixel under the mouse from the texture

	renderer.readRenderTargetPixels( pickingTexture, mouse.x, pickingTexture.height - mouse.y, 1, 1, pixelBuffer );

	//interpret the pixel as an ID

	var id = ( pixelBuffer[ 0 ] << 16 ) | ( pixelBuffer[ 1 ] << 8 ) | ( pixelBuffer[ 2 ] );
	var data = pickingData[ id ];
	if (data) {

		//move our highlightBox so that it surrounds the picked object

		if (data.position && data.rotation && data.vid){
			highlightBox.position.copy(data.position);
			highlightBox.rotation.copy(data.rotation);
			highlightBox.scale.copy(scale);
			highlightBox.visible = true;
		}
		console.log("vid: " + data.vid
					+ "\npos: " + JSON.stringify(data.position));

	} else {
		highlightBox.visible = false;
	}
}
