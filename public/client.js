/******************************************* client-side **************************************************/
console.log('client running\nbuild 2.0');

var verticesFromBackend;
var totalVertexIteration = 0;
var totalEdgeIteration = 0;
var totalVertex = 0;
var totalEdge = 0;
var totalEdgeDrawnCounter = 0;
var originalGraphName = "";
var graphName = "";
var selectedPose = "";
var totalVertexObjectDrawn = [];
var allNonInteractiveEdges = new THREE.Group();

const VERTEX_BATCH_SIZE = 5000;
const EDGE_BATCH_SIZE = 20000;
const RENDER_BUTTON = document.getElementById('render');

// render button event listener
RENDER_BUTTON.addEventListener('click', function(event) {
	counter = 0;
	console.log('button clicked');
	graphName = document.getElementById('graphName').value;
    originalGraphName = graphName;
	if (graphName[0] == '/') {
		graphName = replaceSlash(graphName);
	}

	selectedPose = document.getElementById('selectedPose').value;
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
		RENDER_BUTTON.click();
	}
});

// this API is simplified to merely take over control flow
// after all vertices are drawn
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
        totalEdge = JSON.stringify(responseJSON);
        console.log(graphName + " has " + totalEdge + " edges");

        totalEdgeIteration = Math.floor(totalEdge / EDGE_BATCH_SIZE) + ((totalEdge % EDGE_BATCH_SIZE) ? 1 : 0);
        console.log("need to iterate " + totalEdgeIteration);

        queryGraphEdge(graphName, EDGE_BATCH_SIZE, 0);
    })
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = "count edges failed";
		console.log(err);
	});
}

// draw line segment
function drawEdgeGeometry(fromPos, toPos) {
    var points = extractPoints(fromPos, toPos);
    var edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    edgeGeometriesDrawn.push(edgeGeometry);
}

// query given graph's edges batch by batch, then draw them
function queryGraphEdge(graphName, edgeBatchSize, iteration) {
    fetch('/queryGraphEdge/'
          + graphName + '/'
          + edgeBatchSize + '/'
          + iteration, {method: 'GET'})
        .then(function(response) {
            if (response.ok) {
                console.log('query graph edges successful');
                return response.json();
            }
            throw new Error('query graph edges failed');
        })
        .then(function(responseJSON) {
            // back-end returns an array of edges
            var edgesFromBackend = JSON.parse(JSON.stringify(responseJSON));
            console.log("edges from back-end length " + edgesFromBackend.length);

            totalEdgeDrawnCounter += edgesFromBackend.length;
            // var head = edgesFromBackend["edges"][0]["fromPos"];
            // console.log(head[0]);

            // iterate on all edges, look up end vertices from totalVertexObjectDrawn map to get their coordinates
            for (var i  = 0; i < edgesFromBackend.length; ++i) {
                var fromVertex = edgesFromBackend[i]["from"];
                var toVertex = edgesFromBackend[i]["to"];
                if (totalVertexObjectDrawn[fromVertex] !== undefined &&
                    totalVertexObjectDrawn[toVertex] !== undefined) {

                    drawEdgeGeometry(totalVertexObjectDrawn[fromVertex].position.toArray(),
                                     totalVertexObjectDrawn[toVertex].position.toArray());
                }

            }

            // merge all drawn edge geometries to render a single line segment
            if (edgeGeometriesDrawn.length) {
                var mergedEdgeObject = new THREE.LineSegments(THREE.BufferGeometryUtils.mergeBufferGeometries(edgeGeometriesDrawn),
                                                              defaultEdgeMaterial);
                allNonInteractiveEdges.add(mergedEdgeObject);
            }
            edgeGeometriesDrawn = [];

            if (++iteration < totalEdgeIteration) {
                console.log("draw edges from back-end");
                queryGraphEdge(graphName, edgeBatchSize, iteration);
            } else {
                console.log("draw edges from back-end DONE"
                    + "\ntotal " + totalEdgeDrawnCounter + " edges drawn");
                console.log("\n****************************************\n");
                scene.add(allNonInteractiveEdges);
            }

        })
        .catch(function(err) {
            console.log(err);
        });
}

// query the given graph to count total vertices
// TODO simply use the vertex counter in backend
function countVertex(graphName, selectedPose) {
	console.log('count graph ' + graphName);
    totalEdgeDrawnCounter = 0;
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

		// initialize the vertex object array with a fixed lenght
		totalVertexObjectDrawn = Array.apply(null, Array(totalVertex)).map(function() {});
		totalVertexIteration = Math.floor(totalVertex / VERTEX_BATCH_SIZE) + ((totalVertex % VERTEX_BATCH_SIZE) ? 1 : 0);
		console.log("need to iterate " + totalVertexIteration);
		
		// query the graph in a loop
		if (totalVertex > 0) {
			init();
			animate();
			queryGraphVertex(graphName, selectedPose, VERTEX_BATCH_SIZE, 0);
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
            drawVertexGeometry(vid, curVertex["ori"], curVertex["pos"], curVertex["fullInfo"]);
        }

		// merge all drawn vertex geometries to render a single mesh
		if (vertexGeometriesDrawn.length) {
			var mergedVertexObjects = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(vertexGeometriesDrawn),
                                                     defaultVertexMaterial);
			scene.add(mergedVertexObjects);
		}
		vertexGeometriesDrawn = [];

		if (++iteration < totalVertexIteration) {
			// recursive call, query next batch of vertex
			queryGraphVertex(graphName, selectedPose, vertexBatchSize, iteration);
		} else {
			// query is finished, update both page and console
			document.getElementById('mainDiv').innerHTML = "done";

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
        console.log(vid + " has " + neighborsFromBackend.length + " neighbor edges");

        var fromPos = currentIntersected.position.toArray();

        // iterate on the array to draw green LineSegment as selectable edges
        var leadTo;
        for (var i = 0; i < neighborsFromBackend.length; ++i) {
            leadTo = neighborsFromBackend[i]["to"];
            console.log("lead to " + leadTo);
            // there are some neighbor vertices are not presented in vertices collection
            // but presented in edges collections
            if (totalVertexObjectDrawn[leadTo] !== undefined) {
                drawNeighborEdgeGeometry(fromPos, totalVertexObjectDrawn[leadTo].position.toArray());
                drawNeighborVertexGeometry(leadTo, new THREE.Quaternion().setFromEuler(totalVertexObjectDrawn[leadTo].rotation),
                    totalVertexObjectDrawn[leadTo].position.toArray(),
                    neighborsFromBackend[i]);
            }
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
        canCastRay = true;
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

// helper function to extract points from starting and ending pos
function extractPoints(fromPos, toPos) {
    return [
        fromPos[0], fromPos[1], fromPos[2],
        toPos[0], toPos[1], toPos[2],
    ];
}

// paint the vertex with given color
function applyVertexColors( geometry, color ) {
    var position = geometry.attributes.position;
    var colors = [];

    for (var i = 0; i < position.count; i++) {
        colors.push(color.r, color.g, color.b);
    }

    geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
}

// draw neighbor edges
function drawNeighborEdgeGeometry(fromPos, toPos) {
    var points = extractPoints(fromPos, toPos);
    var selectableEdgeGeometry = new THREE.BufferGeometry();
    selectableEdgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    neighborEdgeGeometries.push(selectableEdgeGeometry);
}

// draw selectable neighbor vertices
var neighborVertexGeometries = [];
var neighborVertexObjects = [];
function drawNeighborVertexGeometry(leadTo, ori, pos, fullEdgeInfo) {

    var geometry = new THREE.ConeBufferGeometry(0.5, 1, 8, 1, false, 0, 6.3);

    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var quaternion = ori;
    var rotation = new THREE.Euler().setFromQuaternion(quaternion);

    matrix.compose(position, quaternion, SCALE);
    geometry.applyMatrix(matrix);
    applyVertexColors(geometry, color.setHex(COLOR_NEIGHBOR_VERTEX));
    neighborVertexGeometries.push(geometry);
    // the actual object to be intersected with
    var neighborVertexObject = new THREE.Mesh(geometry, defaultVertexMaterial);
    neighborVertexObject.position.copy(position);
    neighborVertexObject.rotation.copy(rotation);
    neighborVertexObject.userData = {"fullEdgeInfo": fullEdgeInfo};
    neighborVertexObjects.push(neighborVertexObject);
}

// draw given vertex to the canvas with fullInfo object attached to it
function drawVertexGeometry(vid, ori, pos, fullInfo) {

    var geometry = new THREE.ConeBufferGeometry(0.5, 1, 8, 1, false, 0, 6.3);

    var matrix = new THREE.Matrix4();
    var position = new THREE.Vector3(pos[0], pos[1], pos[2]);
    var quaternion = new THREE.Quaternion(ori[1], ori[2], ori[3], ori[0]);
    var rotation = new THREE.Euler().setFromQuaternion(quaternion);

    matrix.compose(position, quaternion, SCALE);
    geometry.applyMatrix(matrix);
    // give the geometry's vertices color
    applyVertexColors(geometry, color.setHex(COLOR_VERTEX));
    vertexGeometriesDrawn.push(geometry);
    var vertexObject = new THREE.Mesh(geometry, defaultVertexMaterial);
    vertexObject.position.copy(position);
    vertexObject.rotation.copy(rotation);
    vertexObject.userData = {"fullInfo": fullInfo};

    totalVertexObjectDrawn[vid] = vertexObject;
}

/******************************************* three.js **************************************************/
var container, stats;
var vertexInfoWindow, edgeInfoWindow;
var modeDiv, renderOptionDiv;
var buttonToggleAllEdges;
var camera, controls, scene, renderer, light;
var highlightBox, transformBox;
var transformLine;
var raycaster;
var currentIntersected;
var intersectedNeighborVertex;
var transformEdgeDrawn = false;
var panMode = true;
var canCastRay = true;

var defaultVertexMaterial;
var defaultEdgeMaterial;
var neighborEdgeMaterial;

var vertexGeometriesDrawn = [];
var edgeGeometriesDrawn = [];

var mouse = new THREE.Vector2();
var rayTracer = new THREE.Vector2();

var color = new THREE.Color();

const TEXT_SHOW_ALL_EDGES = "Show all edges";
const TEXT_HIDE_ALL_EDGES = "Hide all edges";
const COLOR_VERTEX = 0x135cd3;
const COLOR_EDGE = 0x7f0026;
const COLOR_NEIGHBOR_VERTEX = 0x29bf1e;
const COLOR_NEIGHBOR_EDGE = 0x29bf1e;
const COLOR_ON_SELECT = 0xefdc04;
const SCALE = new THREE.Vector3(0.7, 0.7, 0.7);

function init() {
	vertexGeometriesDrawn = [];
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
	container = document.getElementById("container");
	vertexInfoWindow = document.getElementById("vertexInfoWindow");
	edgeInfoWindow = document.getElementById("edgeInfoWindow");
	modeDiv = document.getElementById("mode");
	modeDiv.style.visibility = "visible";
	renderOptionDiv = document.getElementById("renderOption");
	renderOptionDiv.style.visibility = "visible";
	renderOptionDiv.innerHTML = "graph name: " + originalGraphName
                                + "<br/>chosen pose: " + selectedPose;

    buttonToggleAllEdges = document.getElementById("toggleAllEdges");
	buttonToggleAllEdges.style.visibility = "visible";
	buttonToggleAllEdges.addEventListener('click', onToggleAllEdges);

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100000);
	camera.position.z = 2000;


	defaultVertexMaterial = new THREE.MeshPhongMaterial({color: 0xffffff,
                                                   flatShading: true,
                                                   vertexColors: THREE.VertexColors,
                                                   shininess: 0});
	defaultEdgeMaterial = new THREE.LineBasicMaterial({color: COLOR_EDGE});
    neighborEdgeMaterial = new THREE.LineBasicMaterial({color: COLOR_NEIGHBOR_EDGE});

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xd8d8d8);
	scene.add(new THREE.AmbientLight(0x555555));

	light = new THREE.SpotLight(0xffffff, 1.5);
	light.position.set(10000, 10000, 10000);
	scene.add(light);

	highlightBox = new THREE.Mesh(new THREE.ConeBufferGeometry(0.6, 1.1, 8, 1, false, 0, 6.3),
								  new THREE.MeshLambertMaterial({color: COLOR_ON_SELECT}));
	highlightBox.scale.copy(SCALE);
	scene.add(highlightBox);

	transformBox = new THREE.Mesh(new THREE.ConeBufferGeometry(0.6, 1.1, 8, 1, false, 0, 6.3),
                                  new THREE.MeshLambertMaterial({color: COLOR_ON_SELECT}));

	transformBox.scale.copy(SCALE);
	scene.add(transformBox);

	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	initRenderer();
	initStats();
	initControls();
    document.body.addEventListener('keydown', onDocumentKeyClick);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('scroll', onWindowScroll);
}

function onDocumentMouseClick(event) {
    // mouse click event is blocked by pan mode
    if (event.button === 0 &&
        !panMode && canCastRay) {
        // block next ray cast here, it will enabled in highlight subroutine
        canCastRay = false;
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

    if (vertexInfoWindow.style.visibility === "visible") {
        vertexInfoWindow.style.left = computeVertexInfoWindowLeft();
    }

    if (edgeInfoWindow.style.visibility === "visible") {
        edgeInfoWindow.style.top = computeEdgeInfoWindowTop();
    }
}

function onWindowScroll() {
    if (edgeInfoWindow.style.visibility === "visible") {
        edgeInfoWindow.style.top = computeEdgeInfoWindowTop();
    }
}

function onDocumentKeyClick(event) {
    // toggle pan mode by pressing x
    if (event.key === "x" ||
        event.key === "X") {
        panMode = !panMode;
        modeDiv.innerHTML = "mode: " + ((panMode) ? "control" : "select");
    }
}

function onToggleAllEdges(event) {
    console.log(buttonToggleAllEdges.textContent + " clicked");
    if (buttonToggleAllEdges.textContent === TEXT_HIDE_ALL_EDGES) {
        buttonToggleAllEdges.innerHTML = TEXT_SHOW_ALL_EDGES;
        allNonInteractiveEdges.visible = false;
    } else {
        buttonToggleAllEdges.innerHTML = TEXT_HIDE_ALL_EDGES;
        allNonInteractiveEdges.visible = true;
    }
}

function computeVertexInfoWindowLeft() {
    return (window.innerWidth - vertexInfoWindow.offsetWidth - 20) + "px";
}

function computeEdgeInfoWindowTop() {
    return (window.innerHeight - edgeInfoWindow.offsetHeight - 30 - window.pageYOffset) + "px";
}

// animate loop, render the scene
function animate() {
	requestAnimationFrame(animate);
	render();
	stats.update();
}

function render() {
	controls.update();
    // switch to toggle raycaster to selectable neighbor vertices
    if (hoverNeighborON) {
        highlightNeighborVertex();
    }
	renderer.render(scene, camera);
}

// highlight neighbor vertices on mouse over
function highlightNeighborVertex() {
    raycaster.setFromCamera(rayTracer, camera);

    var intersects = raycaster.intersectObjects(neighborVertexObjects);

    if (intersects.length > 0) {
        if (intersectedNeighborVertex !== undefined &&
            intersectedNeighborVertex !== intersects[0].object) {
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

// subroutine of neighbor vertices highlighting
// it displays info of selected edge and draws transformBox and transformLine to visualize edge transform info
function highlightIntersectedNeighborVertex() {

    // display info of this edge
    edgeInfoWindow.style.top = computeEdgeInfoWindowTop();
    edgeInfoWindow.innerHTML = "edge info:\n" + JSON.stringify(intersectedNeighborVertex.userData["fullEdgeInfo"], null, 2);
    edgeInfoWindow.style.visibility = "visible";


    // get pos and ori of selected vertex
    var intersectPos = currentIntersected.position;
    var intersectOri = currentIntersected.quaternion;

    if (intersectedNeighborVertex.userData["fullEdgeInfo"]["relative_pose"] !== undefined) {
        var transPosVec = intersectedNeighborVertex.userData["fullEdgeInfo"]["relative_pose"]["position"];
        var transOriVec = intersectedNeighborVertex.userData["fullEdgeInfo"]["relative_pose"]["orientation"];

        // construct THREE.js Vector3 and Quaternion from hovered neighbor vertex
        var transPos = new THREE.Vector3().fromArray(transPosVec);
        var transOriVecShuffled = [transOriVec[1], transOriVec[2], transOriVec[3], transOriVec[0]];
        var transOri = new THREE.Quaternion().fromArray(transOriVecShuffled);

        // construct 4x4 transform matrix from selected vertex and hovered vertex
        var selectedVertexMat = new THREE.Matrix4().compose(intersectPos, intersectOri, SCALE);
        var selectedNeighborVertexMat = new THREE.Matrix4().compose(transPos, transOri, SCALE);
        // compose a transformed matrix
        var transformationMat = new THREE.Matrix4().multiplyMatrices(selectedVertexMat, selectedNeighborVertexMat);

        // reset previously drawn transfromLine and transformBox here
        // this ensures user to pan the view while retaining neighbor edge data
        resetTransformBoxAndLine();
        if (!transformEdgeDrawn) {
            console.log("drawing neighbor edge and vertex");
            var tempPos = new THREE.Vector3();
            var tempOri = new THREE.Quaternion();
            var tempScale = new THREE.Vector3();
            transformationMat.decompose(tempPos, tempOri, tempScale);
            drawTransformEdge(tempPos.toArray(), intersectPos.toArray());

            var position = new THREE.Vector3().fromArray(tempPos.toArray());
            var quaternion = new THREE.Quaternion().fromArray(tempOri.toArray());
            var rotation = new THREE.Euler().setFromQuaternion(quaternion);
            transformBox.position.copy(position);
            transformBox.rotation.copy(rotation);
            transformBox.visible = true;
        }
    }
}

// captures mouse out action on hovered edge, does not do much
function resetIntersectedNeighborVertex() {
    console.log("reset hit edge vid " + intersectedNeighborVertex.userData["fullEdgeInfo"]["to"]);
}

// hide previously shown transformBox and transformLine
function resetTransformBoxAndLine() {
    transformEdgeDrawn = false;
    if (transformLine !== undefined &&
        transformBox !== undefined) {

        transformLine.visible = false;
        transformBox.visible = false;
        disposeObject(transformLine);
    }
}

// draw an edge between the hovered neighbor vertex and transformed originating vertex
function drawTransformEdge(fromPos, toPos) {
    var points = extractPoints(fromPos, toPos);
    var edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    transformLine = new THREE.LineSegments(edgeGeometry, neighborEdgeMaterial);
    transformLine.visible = true;
    scene.add(transformLine);
    transformEdgeDrawn = true;
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

// highlight vertex on mouse click
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
        if (currentIntersected.userData["fullInfo"]["id"]) {
            getVertexNeighbors(graphName, currentIntersected.userData["fullInfo"]["id"]);
        }

	} else {
		// not intersected, need to reset state if something is intersected previously
		if (currentIntersected !== undefined) {
			resetPrevIntersect();
		}
		currentIntersected = undefined;
		canCastRay = true;
	}
}

// highlight chosen vertex
function highlightIntersect() {
    console.log("hit vertex");
    highlightBox.position.copy(currentIntersected.position);
    highlightBox.rotation.copy(currentIntersected.rotation);
    highlightBox.visible = true;
    // console.log(JSON.stringify(currentIntersected.userData["fullInfo"], null, 2));

    // display selected vertex info window
    vertexInfoWindow.style.left = computeVertexInfoWindowLeft();
    vertexInfoWindow.innerHTML = "selected vertex info:\n"
                                 + JSON.stringify(currentIntersected.userData["fullInfo"], null, 2);
    vertexInfoWindow.style.visibility = "visible";
}

// reset previously highlighted element
function resetPrevIntersect() {
    console.log("reset hit");
    highlightBox.visible = false;
    // hide the display info window
    vertexInfoWindow.style.visibility = "hidden";

    cleanUpAfterDeselect();
}

// clean-up procedure for deselecting vertex
function cleanUpAfterDeselect() {
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

    // reset transformLine and transformBox when user deselect the vertex
    resetTransformBoxAndLine();
    // hide displayed info of hovered neighbor edge
    edgeInfoWindow.style.visibility = "hidden";
}
