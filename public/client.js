/******************************************* client-side **************************************************/
console.log('client running');

var vertexArray;
const batchSize = 5000;
var totalIteration = 0;
var totalVertex = 0;


const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	counter = 0;
	console.log('button clicked');
	var graphName = document.getElementById('graphName').value;
	if (graphName[0] == '/') {
		graphName = replaceSlash(graphName);
	}
	// query the given graph to count total vertex count
	countVertex(graphName);
});

const input = document.getElementById('graphName');
input.addEventListener('keyup', function(event) {
	event.preventDefault();

	if (event.keyCode === 13) {
		button.click();
	}
});

function countVertex(graphName) {
	console.log('count graph ' + graphName);
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
		totalIteration = Math.floor(totalVertex / batchSize) + ((totalVertex % batchSize) ? 1 : 0);
		console.log("need to iterate " + totalIteration);
		// query the graph in a loop
		if (totalVertex > 0) {
			// init all geometry arrays
			geometriesDrawn = [];
			geometriesPicking = [];
			pickingData = [];
			edgesDrawn = [];
			init();
			animate();
			queryGraph(graphName, batchSize, 0);
		} else {
			throw new Error('count vertex failed');		
		}
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
}

function queryGraph(graphName, batchSize, iteration) {
	fetch('/queryGraph/' + graphName + '/' + batchSize + '/' + iteration, {method: 'GET'})
	.then(function(response) {
		if (response.ok) {
			console.log('query graph successful');
			return response.json();
		}
		throw new Error('query graph failed');
	})
	.then(function(responseJSON) {
		console.log("rendering response");
		// TODO consume response here to render
		// vertexArray.push.apply(vertexArray, JSON.parse(JSON.stringify(responseJSON)));
		vertexArray = JSON.parse(JSON.stringify(responseJSON));
		for (var i = 0; i < vertexArray.length; ++i) {
			var vertex = vertexArray[i];
			parseVertex(vertex);
		}

		/******************************************* crazy *******************************************/

			// var matrix = new THREE.Matrix4();
			// var quaternion = new THREE.Quaternion();

			// for ( var i = 0; i < 100; i ++ ) {

			// 	var geometry = new THREE.ConeBufferGeometry(2.0, 15, 8, 1, false, 0, 6.3);
			// 	var position = new THREE.Vector3();
			// 	position.x = Math.random() * 10000 - 5000;
			// 	position.y = Math.random() * 6000 - 3000;
			// 	position.z = Math.random() * 8000 - 4000;

			// 	var rotation = new THREE.Euler();
			// 	rotation.x = Math.random() * 2 * Math.PI;
			// 	rotation.y = Math.random() * 2 * Math.PI;
			// 	rotation.z = Math.random() * 2 * Math.PI;

			// 	quaternion.setFromEuler( rotation, false );
			// 	matrix.compose( position, quaternion, scale );

			// 	geometry.applyMatrix( matrix );

			// 	// give the geometry's vertices a random color, to be displayed

			// 	applyVertexColors( geometry, color.setHex( colorVertex) );

			// 	geometriesDrawn.push( geometry );

			// 	geometry = geometry.clone();
			// 	// give the geometry's vertices a color corresponding to the "id"

			// 	applyVertexColors( geometry, color.setHex( i ) );

			// 	geometriesPicking.push( geometry );

			// 	pickingData[ i ] = {
			// 		position: position,
			// 		rotation: rotation,
			// 		scale: scale
			// 	};

			// }

			// drawRandomEdges(geometriesDrawn);

		/******************************************* crazy *******************************************/
		if (geometriesDrawn.length) {
			var mergedVertexObjects = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(geometriesDrawn), defaultMaterial);
			scene.add(mergedVertexObjects);	
		}
		geometriesDrawn = [];

		if (edgesDrawn.length) {
			var mergedEdgeObject = new THREE.LineSegments(THREE.BufferGeometryUtils.mergeBufferGeometries(edgesDrawn), lineMaterial);
			scene.add(mergedEdgeObject);
		}
		edgesDrawn = [];

		console.log("vertex array length " + vertexArray.length);
		if (++iteration < totalIteration) {
			queryGraph(graphName, batchSize, iteration);
		} else {
			document.getElementById('mainDiv').innerHTML = JSON.stringify(vertexArray[0]);
			// document.getElementById('mainDiv').innerHTML = "done";

			// pickingScene.add( new THREE.Mesh( THREE.BufferGeometryUtils.mergeBufferGeometries( geometriesPicking ), pickingMaterial ) );			
			console.log("rendering finished");	
		}
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
}

function replaceSlash(input) {
	console.log("replacing slash for " + input);
	return input.replace(/\//g, '%2F');
}

// draw line
function drawEdge(fromPos, toPos) {
	var points = [
		fromPos[0], fromPos[1], fromPos[2],
		toPos[0], toPos[1], toPos[2],
	];

	var edgeGeometry = new THREE.BufferGeometry();
	edgeGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
	edgesDrawn.push(edgeGeometry);
}

// handles edges array
function parseEdgesArray(edges, pos) {
	console.log("found edges\nedges length " + edges.length);
	for (var i = 0; i < edges.length; ++i) {
		let edge = edges[i];
		let leadTo = JSON.stringify(edge["to"]);
		console.log("lead to " + leadTo);
		if (verticesDrawn[leadTo]) {
			console.log(leadTo + " is already drawn, linking...");
			drawEdge(pos, verticesDrawn[leadTo]);
		} else {
			console.log(leadTo + " is not drawn, add to oweEdges map");
			if (!(leadTo in oweEdges)) {
				console.log("creating entry for " + leadTo);
				oweEdges[leadTo] = [];
			}
			oweEdges[leadTo].push(pos);
		}
	}
}

function payTheDebt(vid, pos) {
	// if this vid owes other vertices edge
	if (vid in oweEdges) {
		console.log("vid " + vid + " paying debt...");
		while(oweEdges[vid].length) {
			drawEdge(pos, oweEdges[vid].pop());
		}
		// delete the entry in verticesDraw
		delete oweEdges[vid];
	}
}

// handle poses JSON
function parsePoses(poses, vid) {
	console.log("found poses");

	var firstPose, ori, pos;

	if (poses !== undefined) {
		for (var pose in poses) {
			firstPose = pose;
			ori = poses[pose].ori;
			pos = poses[pose].pos;
			if (ori !== undefined && pos !== undefined) {
				console.log("first pose " + firstPose
							+ "\nori: " + ori
							+ "\npos: " + pos);

				var geometry = new THREE.ConeBufferGeometry(0.5, 1, 8, 1, false, 0, 6.3);

				var matrix = new THREE.Matrix4();
				var position = new THREE.Vector3(pos[0], pos[1], pos[2]);
				var quaternion = new THREE.Quaternion(ori[1], ori[2], ori[3], ori[0]);
				var rotation = new THREE.Euler().setFromQuaternion(quaternion);

				matrix.compose(position, quaternion, scale);
				geometry.applyMatrix(matrix);
				// give the geometry's vertices color
				applyVertexColors(geometry, color.setHex(colorVertex));
				geometriesDrawn.push(geometry);

				// the rest of this section servers the pick function
				geometry = geometry.clone();
				// give the geometry's vertices a color corresponding to the id
				applyVertexColors(geometry, color.setHex(universalCounter));

				// geometriesPicking.push(geometry);

				// pickingData[universalCounter] = {
				// 	position: position,
				// 	rotation: rotation,
				// 	vid: vid
				// };
				++universalCounter;
				verticesDrawn[vid] = pos;
				// TODO if this vid is in oweEdges, need to clear the corresponding entry and draw edges
				payTheDebt(vid, pos);
				return pos;
			}

		}

	} else {
		console.log("pose is undefined");
	}
	return undefined;
}

function parseVertex(vertex) {
	var edges;
	var poses;
	var pos;
	console.log("parsing " + vertex.vid);
	// iterate on all field in this JSON
	for (var item in vertex) {
		if (item === "edges") {
			edges = vertex[item];
		} else if (item === "poses") {
			poses = vertex[item];
		}
	}
	// check poses and edges separately
	// as some vertices do not have edges field
	if (poses) {
		pos = parsePoses(poses, vertex.vid);
	}

	// connect edges to neighbors
	if (edges && pos) {
		parseEdgesArray(edges, pos);
	}
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

var geometriesDrawn = [];
var geometriesPicking = [];
var edgesDrawn = [];
var verticesDrawn = {};
var oweEdges = {};

var mouse = new THREE.Vector2();
var rayTracer = new THREE.Vector2();

var color = new THREE.Color();
const colorVertex = 0x135cd3;
const colorEdge = 0x7f0026;
const colorOnSelect = 0xefdc04;

const scale = new THREE.Vector3(1, 1, 1);

var universalCounter = 0;

// TODO render the scene batch by batch
// init();
// animate();

function init() {
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
	camera.position.z = 5000;

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

	
	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	renderer = new THREE.WebGLRenderer( { antialias: false } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	stats = new Stats();
	container.appendChild( stats.dom );

	highlightBox = new THREE.Mesh(new THREE.ConeBufferGeometry(1.5, 5.5, 8, 1, false, 0, 6.3),
								  new THREE.MeshLambertMaterial( { color: 0xffff00 }));
	scene.add(highlightBox);
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

	var intersects = raycaster.intersectObjects(edgesDrawn);

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

// construct a fully connected graph
// TODO this should be modified when backend is setup
// TODO use instancing to reduce memory pressure
function drawRandomEdges(geometriesDrawn) {
	var lineGeometries = [];
	for (var i = 0; i < geometriesDrawn.length; ++i) {
		var vi = geometriesDrawn[i];
		var posI = vi.getAttribute('position').array;

		for (var j = 0; j < (geometriesDrawn.length / 10); ++j) {
			if (i != j) {
				var vj = geometriesDrawn[j];
				var posJ = vj.getAttribute('position').array;
				var points = [posI[0], posI[1], posI[2],
							  posJ[0], posJ[1], posJ[2]];

				var lineGeometry = new THREE.BufferGeometry();
				lineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(points, 3));
				lineGeometries.push(lineGeometry);
				var lineObject = new THREE.Line(lineGeometry);
				lineObject.material.color.setHex(colorEdge);
				edgesDrawn.push(lineObject);
			}
		}
	}

	var mergedLineObject = new THREE.Line(THREE.BufferGeometryUtils.mergeBufferGeometries(lineGeometries), lineMaterial);
	scene.add(mergedLineObject);
}
