/******************************************* client-side **************************************************/
console.log('client running');

var verticesFromBackend;
const vertexBatchSize = 5000;
const edgeBatchSize = 20000;
var totalIteration = 0;
var totalVertex = 0;
var totalEdgeDrawn = 0;
var graphName = "";

const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	counter = 0;
	console.log('button clicked');
	graphName = document.getElementById('graphName').value;
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
            queryGraphEdge(graphName, edgeBatchSize, 0);
            return;
		}
		throw new Error('count edges failed');
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

var totalVertexObjectDrawn = [];
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
            drawVertexGeometry(vid, curVertex["ori"], curVertex["pos"], curVertex["fullInfo"]);
        }

		// merge all drawn vertex geometries to render a single mesh
		if (vertexGeometriesDrawn.length) {
			var mergedVertexObjects = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(vertexGeometriesDrawn),
                                                     defaultVertexMaterial);
			scene.add(mergedVertexObjects);
		}
		vertexGeometriesDrawn = [];

		if (++iteration < totalIteration) {
			// recursive call, query next batch of vertex
			queryGraphVertex(graphName, selectedPose, vertexBatchSize, iteration);
		} else {
			// query is finished, update both page and console
			document.getElementById('mainDiv').innerHTML = "done";

			// pickingScene.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(vertexGeometriesPicking),
            //                                 pickingMaterial));
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
            drawEdgeGeometry(fromPos, toPos);
        }

        // merge all drawn edge geometries to render a single line segment
        if (edgeGeometriesDrawn.length) {
        	var mergedEdgeObject = new THREE.LineSegments(THREE.BufferGeometryUtils.mergeBufferGeometries(edgeGeometriesDrawn),
                                                          defaultEdgeMaterial);
        	scene.add(mergedEdgeObject);
        }
        edgeGeometriesDrawn = [];

        if (backEndIndex < totalVertex) {
            console.log("draw edges from back-end");
            queryGraphEdge(graphName, edgeBatchSize, ++backEndIndex);
        } else {
            console.log("draw edges from back-end DONE"
                        + "\ntotal " + totalEdgeDrawn + " edges drawn");
            console.log("\n****************************************\n");
        }

    })
    .catch(function(err) {
        console.log(err);
    });
}

// query given vertex's neighbors
var neighborEdgeGeometries = [];
var mergedNeighborEdgeObject;
var mergedNeighborVertexObject;
var hoverNeighborON = false;
function getVertexNeighbors(graphName, vid) {
    console.log("query graph " + graphName
                + "\nvid " + vid);

    fetch('/getVertexNeighbor/' + graphName + '/' + vid, {method: 'GET'})
    .then(function(response) {
        if (response.ok) {
            console.log("get vertex neighbors successful");
            return response.json();
        }
        throw new Error("get vertex neighbors failed");
    })
    .then(function(responseJSON) {

        var neighborsFromBackend = JSON.parse(JSON.stringify(responseJSON));
        // console.log(neighborsFromBackend);
        var fromPos = neighborsFromBackend["fromPos"]["pos"];
        console.log("fromPos ori " + neighborsFromBackend["fromPos"]["ori"]);
        var edges = neighborsFromBackend["edges"];
        var edgesKeyView = Object.keys(edges);

        console.log(vid + " pos " + fromPos);
        console.log(vid + " has " + edgesKeyView.length + " edges");

        // iterate on the array to draw green LineSegment as selectable edges
        var leadTo;
        for (var i = 0; i < edgesKeyView.length; ++i) {
            leadTo = edgesKeyView[i];
            drawNeighborEdgeGeometry(fromPos, edges[leadTo]["pos"]);
            drawNeighborVertexGeometry(leadTo, edges[leadTo]["ori"], edges[leadTo]["pos"],
                               edges[leadTo]["fullEdgeInfo"]);
        }

        // merge and render all drawn green line segments
        if (neighborEdgeGeometries.length) {
            mergedNeighborEdgeObject = new THREE.LineSegments(THREE.BufferGeometryUtils.mergeBufferGeometries(neighborEdgeGeometries),
                                                              neighborEdgeMaterial);
            scene.add(mergedNeighborEdgeObject);
        }
        neighborEdgeGeometries = [];

        // merge and render all drawn neighbor vertices
        if (neighborVertexGeometries.length) {
            mergedNeighborVertexObject = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(neighborVertexGeometries),
                                                        defaultVertexMaterial);
            scene.add(mergedNeighborVertexObject);
        }
        neighborVertexGeometries = [];

        if (neighborVertexObjects.length) {
            hoverNeighborON = true;
        }
    })
    .catch(function(err) {
        console.log(err);
    });
}

// dispose given object and remove it from scene
function disposeObject(obj) {
    if (obj !== undefined) {
        obj.geometry.dispose();
        obj.material.dispose();
        scene.remove(obj);
        obj = undefined;
    }
}

// replace slash to %2F in the query url
function replaceSlash(input) {
	console.log("replacing slash for " + input);
	return input.replace(/\//g, '%2F');
}

// helper function to extract points from starting and ending pos
function extractPoints(fromPos, toPos) {
    return [
        fromPos[0], fromPos[1], fromPos[2],
        toPos[0], toPos[1], toPos[2],
    ];
}

// draw line segment
function drawEdgeGeometry(fromPos, toPos) {
	var points = extractPoints(fromPos, toPos);
	var edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
	edgeGeometriesDrawn.push(edgeGeometry);
}

// draw neighbor edges
function drawNeighborEdgeGeometry(fromPos, toPos) {
    // console.log("draw selectable edge"
    //             + "\nfrom " + fromPos
    //             + "\nto " + toPos);

    var points = extractPoints(fromPos, toPos);
    var selectableEdgeGeometry = new THREE.BufferGeometry();
    selectableEdgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    neighborEdgeGeometries.push(selectableEdgeGeometry);
}

// draw selectable neighbor vertices
var neighborVertexGeometries = [];
var neighborVertexObjects = [];
function drawNeighborVertexGeometry(leadTo, ori, pos, fullEdgeInfo) {
    // console.log("draw neighbor " + leadTo
    //             + "\nori " + ori + "\npos " + pos);

    var geometry = new THREE.ConeBufferGeometry(0.5, 1, 8, 1, false, 0, 6.3);

    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var quaternion = new THREE.Quaternion(ori[1], ori[2], ori[3], ori[0]);
    var rotation = new THREE.Euler().setFromQuaternion(quaternion);

    matrix.compose(position, quaternion, scale);
    geometry.applyMatrix(matrix);
    applyVertexColors(geometry, color.setHex(colorNeighborVertex));
    neighborVertexGeometries.push(geometry);
    // the actual object to be intersected with
    var neighborVertexObject = new THREE.Mesh(geometry, defaultVertexMaterial);
    neighborVertexObject.position.copy(position);
    neighborVertexObject.rotation.copy(rotation);
    neighborVertexObject.userData = {"fullEdgeInfo": fullEdgeInfo};
    neighborVertexObjects.push(neighborVertexObject);
}

// handle poses JSON
function drawVertexGeometry(vid, ori, pos, fullInfo) {

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
    var vertexObject = new THREE.Mesh(geometry, defaultVertexMaterial);
    vertexObject.position.copy(position);
    vertexObject.rotation.copy(rotation);
    vertexObject.userData = {"fullInfo": fullInfo};

    totalVertexObjectDrawn.push(vertexObject);

    // the rest of this section servers the pick function
    // geometry = geometry.clone();
    // give the geometry's vertices a color corresponding to the id
    // applyVertexColors(geometry, color.setHex(universalCounter));

    // vertexGeometriesPicking.push(geometry);

    // pickingData[universalCounter] = {
    // 	position: position,
    // 	rotation: rotation,
    // 	vid: vid
    // };
    // ++universalCounter;
}

/******************************************* three.js **************************************************/
var container, stats;
var camera, controls, scene, renderer, light;
var pickingData = [], pickingTexture, pickingScene;
var highlightBox, transformBox;
var transformLine;
var raycaster;
var currentIntersected;

var pickingMaterial;
var defaultVertexMaterial;
var defaultEdgeMaterial;
var neighborEdgeMaterial;

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
const colorNeighborVertex = 0x29bf1e;
const colorNeighborEdge = 0x29bf1e;
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

function initRenderer() {
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.setAttribute("id", "canvas");
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
    renderer.domElement.addEventListener('mouseup', onDocumentMouseClick);
    container.appendChild(renderer.domElement);
}

function initStats() {
    stats = new Stats();
    stats.domElement.setAttribute("id", "stats");
    container.appendChild(stats.domElement);
}

function initInvariants() {
	container = document.getElementById( "container" );

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100000);
	camera.position.z = 2000;

	pickingScene = new THREE.Scene();
	pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
	pickingTexture.texture.minFilter = THREE.LinearFilter;

	pickingMaterial = new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors});
	defaultVertexMaterial = new THREE.MeshPhongMaterial({color: 0xffffff,
                                                   flatShading: true,
                                                   vertexColors: THREE.VertexColors,
                                                   shininess: 0});
	defaultEdgeMaterial = new THREE.LineBasicMaterial({color: colorEdge});
    neighborEdgeMaterial = new THREE.LineBasicMaterial({color: colorNeighborEdge});

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xd8d8d8);
	scene.add(new THREE.AmbientLight(0x555555));

	light = new THREE.SpotLight(0xffffff, 1.5);
	light.position.set(10000, 10000, 10000);
	scene.add(light);

	highlightBox = new THREE.Mesh(new THREE.ConeBufferGeometry(0.6, 1.1, 8, 1, false, 0, 6.3),
								  new THREE.MeshLambertMaterial({color: colorOnSelect}));
	highlightBox.scale.copy(scale);
	scene.add(highlightBox);

	transformBox = new THREE.Mesh(new THREE.ConeBufferGeometry(0.6, 1.1, 8, 1, false, 0, 6.3),
                                  new THREE.MeshLambertMaterial({color: colorOnSelect}));

	transformBox.scale.copy(scale);
	scene.add(transformBox);

	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	initRenderer();
	initStats();
	initControls();
    window.addEventListener('resize', onWindowResize);
}

function onDocumentMouseClick(event) {
    if (event.button === 0) {
        highlight(totalVertexObjectDrawn);
    }
}

function onDocumentMouseMove(event) {
	// event.preventDefault();
	rayTracer.x = ( event.offsetX / window.innerWidth) * 2 - 1;
	rayTracer.y = - ( event.offsetY / window.innerHeight ) * 2 + 1;

	mouse.x = event.offsetX;
	mouse.y = event.offsetY;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// animate loop, render the scene
function animate() {
	requestAnimationFrame( animate );
	render();
	stats.update();
}

function render() {
	controls.update();
    // switch to toggle raycaster to selectable neighbor vertices
    if (hoverNeighborON) {
        highlightNeighborVertex();
    }
	renderer.render( scene, camera );
}

var intersectedNeighborVertex;
function highlightNeighborVertex() {
    raycaster.setFromCamera(rayTracer, camera);

    var intersects = raycaster.intersectObjects(neighborVertexObjects);

    if (intersects.length > 0) {
        if (intersectedNeighborVertex !== undefined) {
            resetIntersectedNeighborVertex();
        }
        intersectedNeighborVertex = intersects[0].object;
        highlightIntersectedNeighborVertex();
    } else {
        if (intersectedNeighborVertex !== undefined) {
            resetIntersectedNeighborVertex();
        }
        intersectedNeighborVertex = undefined;
    }
}

function highlightIntersectedNeighborVertex() {
    // console.log("hit vid " + intersectedNeighborVertex.userData["fullEdgeInfo"]["to"]
    //             + "\n" + JSON.stringify(intersectedNeighborVertex.userData["fullEdgeInfo"], null, 2));
    // TODO display more info of this edge

    // TODO visualize edge transformation to selected edge

    var intersectPos = currentIntersected.position.toArray();
    var intersectOri = currentIntersected.quaternion.toArray();
    if (intersectedNeighborVertex.userData["fullEdgeInfo"]["transform"] !== undefined) {
        var transPos = intersectedNeighborVertex.userData["fullEdgeInfo"]["transform"]["pos"];
        var transOri = intersectedNeighborVertex.userData["fullEdgeInfo"]["transform"]["ori"];
        console.log("before\ninterPos\n" + intersectPos + "\ninterOri\n" + intersectOri
                    + "\ntransPos\n" + transPos + "\ntransOri\n" + transOri);
        applyTransform(intersectPos, transPos, intersectPos.length);
        applyTransform(intersectOri, transOri, intersectOri.length);
        console.log("after\ninterPos\n" + intersectPos + "\ninterOri\n" + intersectOri);
        if (!transformEdgeDrawn) {
            drawTransformEdge(intersectedNeighborVertex.position.toArray(), intersectPos);
            // TODO need to draw a transformBox here
            var position = new THREE.Vector3();
            position.fromArray(intersectPos);
            var quaternion = new THREE.Quaternion();
            quaternion.fromArray(intersectOri);
            var rotation = new THREE.Euler().setFromQuaternion(quaternion);
            transformBox.position.copy(position);
            transformBox.rotation.copy(rotation);
            transformBox.visible = true;
        }
    }
}

var transformEdgeDrawn = false;
function resetIntersectedNeighborVertex() {
    console.log("reset hit vid " + intersectedNeighborVertex.userData["fullEdgeInfo"]["to"]);
    // TODO hide the display window

    // TODO hide the visualized edge transformation
    transformEdgeDrawn = false;
    if (transformLine !== undefined) {
        transformLine.visible = false;
        transformBox.visible = false;
        disposeObject(transformLine);
    }
}

function drawTransformEdge(fromPos, toPos) {
    var points = extractPoints(fromPos, toPos);
    var edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    transformLine = new THREE.LineSegments(edgeGeometry, neighborEdgeMaterial);
    transformLine.visible = true;
    scene.add(transformLine);
    transformEdgeDrawn = true;
}

// TODO implement a switch to toggle between select mode and pan mode
function highlight(objectsToIntersect) {

	raycaster.setFromCamera(rayTracer, camera);

	var intersects = raycaster.intersectObjects(objectsToIntersect);

	// intersected
	if ( intersects.length > 0 ) {
		
		// something is intersected previously, need to reset
		if (currentIntersected !== undefined) {
			resetPrevIntersect();
		}

		currentIntersected = intersects[0].object;
		highlightIntersect();

        // this click event triggers a query
        if (currentIntersected.userData["fullInfo"]["vid"]) {
            getVertexNeighbors(graphName, currentIntersected.userData["fullInfo"]["vid"]);
        }

	} else {
		// not intersected, need to reset state if something is intersected previously
		if (currentIntersected !== undefined) {
			resetPrevIntersect();
		}
		currentIntersected = undefined;
	}
}

function applyTransform(original, transform, size) {
    for (var i = 0; i < size; ++i) {
        original[i] += transform[i];
    }
}

// highlight intersected element
function highlightIntersect() {
    console.log("hit vertex");
    highlightBox.position.copy(currentIntersected.position);
    highlightBox.rotation.copy(currentIntersected.rotation);
    highlightBox.visible = true;
    console.log(JSON.stringify(currentIntersected.userData["fullInfo"], null, 2));
    // TODO display selected vertex info somehow
}

// reset previously highlighted element
function resetPrevIntersect() {
    console.log("reset hit");
    // TODO hide the display info somehow

    // dispose geometry and material of selectable neighbor vertices to release memory
    if (mergedNeighborEdgeObject !== undefined) {
        disposeObject(mergedNeighborEdgeObject);
    }

    if (mergedNeighborVertexObject !== undefined) {
        disposeObject(mergedNeighborVertexObject);
    }

    hoverNeighborON = false;
    while (neighborVertexObjects.length) {
        disposeObject(neighborVertexObjects.pop());
    }

    highlightBox.visible = false;
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
			highlightBox.visible = true;
		}
		console.log("vid: " + data.vid
					+ "\npos: " + JSON.stringify(data.position));

	} else {
		highlightBox.visible = false;
	}
}
