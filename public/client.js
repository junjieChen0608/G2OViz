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

function countVertex(graphName) {
	console.log('count graph ' + graphName);
	vertexArray = [];
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
		// CAUTION BUG out of memory is still an issue
		// TODO consume response here to render
		// vertexArray.push.apply(vertexArray, JSON.parse(JSON.stringify(responseJSON)));
		// vertexArray = JSON.parse(JSON.stringify(responseJSON));

		/******************************************* crazy *******************************************/
			init();
			animate();

			function init() {
				initInvariants();
				
				var matrix = new THREE.Matrix4();
				var quaternion = new THREE.Quaternion();
				var color = new THREE.Color();

				for ( var i = 0; i < 50000; i ++ ) {

					var geometry = new THREE.ConeBufferGeometry(2.0, 15, 8, 1, false, 0, 6.3);
					var position = new THREE.Vector3();
					position.x = Math.random() * 10000 - 5000;
					position.y = Math.random() * 6000 - 3000;
					position.z = Math.random() * 8000 - 4000;

					var rotation = new THREE.Euler();
					rotation.x = Math.random() * 2 * Math.PI;
					rotation.y = Math.random() * 2 * Math.PI;
					rotation.z = Math.random() * 2 * Math.PI;

					var scale = new THREE.Vector3(10, 10, 10);
					// scale.x = Math.random() * 200 + 100;
					// scale.y = Math.random() * 200 + 100;
					// scale.z = Math.random() * 200 + 100;

					quaternion.setFromEuler( rotation, false );
					matrix.compose( position, quaternion, scale );

					geometry.applyMatrix( matrix );

					// give the geometry's vertices a random color, to be displayed

					applyVertexColors( geometry, color.setHex( Math.random() * 0xffffff ) );

					geometriesDrawn.push( geometry );

					geometry = geometry.clone();
					// give the geometry's vertices a color corresponding to the "id"

					applyVertexColors( geometry, color.setHex( i ) );

					geometriesPicking.push( geometry );

					pickingData[ i ] = {

						position: position,
						rotation: rotation,
						scale: scale

					};

				}

				var objects = new THREE.Mesh( THREE.BufferGeometryUtils.mergeBufferGeometries( geometriesDrawn ), defaultMaterial );
				scene.add( objects );

				pickingScene.add( new THREE.Mesh( THREE.BufferGeometryUtils.mergeBufferGeometries( geometriesPicking ), pickingMaterial ) );

			}

		/******************************************* crazy *******************************************/
		console.log("vertex array length " + vertexArray.length);
		if (++iteration < totalIteration) {
			queryGraph(graphName, batchSize, iteration);
		} else {
			document.getElementById('mainDiv').innerHTML = JSON.stringify(vertexArray[0]);
			// document.getElementById('mainDiv').innerHTML = "done";
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

/******************************************* three.js **************************************************/
var container, stats;
var camera, controls, scene, renderer, light;
var pickingData = [], pickingTexture, pickingScene;
var highlightBox;
var raycaster;
var currentIntersected;

var pickingMaterial;
var defaultMaterial;

var geometriesDrawn = [];
var geometriesPicking = [];

var mouse = new THREE.Vector2();

var color = new THREE.Color();
var colorVertex = 0x135cd3;
var colorEdge = 0x7f0026;
var colorOnSelect = 0xefdc04;

var startTime = Date.now();
// TODO render the scene batch by batch
// init();
// animate();

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
	camera.position.z = 7000;

	pickingScene = new THREE.Scene();
	pickingTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight );
	pickingTexture.texture.minFilter = THREE.LinearFilter;

	pickingMaterial = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );
	defaultMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true, vertexColors: THREE.VertexColors, shininess: 0	} );

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xd8d8d8);
	scene.add(new THREE.AmbientLight(0x555555));

	scene.add( new THREE.AmbientLight( 0x555555 ) );
	light = new THREE.SpotLight(0xffffff, 1.5);
	light.position.set(0, 2000, 2000);
	scene.add(light);

	
	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	renderer = new THREE.WebGLRenderer( { antialias: false } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	stats = new Stats();
	container.appendChild( stats.dom );

	highlightBox = new THREE.Mesh(
		new THREE.ConeBufferGeometry(2.0, 15, 8, 1, false, 0, 6.3),
		new THREE.MeshLambertMaterial( { color: 0xffff00 }
	) );
	scene.add(highlightBox);
	// renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
	renderer.domElement.addEventListener( 'mousemove', onMouseMove );
	initControls();
	window.addEventListener('resize', onWindowResize);
}

// function init() {

// 	initInvariants();
// 	var geometriesDrawn = [];
// 	var matrix = new THREE.Matrix4();
// 	var quaternion = new THREE.Quaternion();

// 	// TODO generate n random geometries to the scene
// 	// this should be changed to load vertex from MongoDB
// 	// TODO use instancing to reduce memory pressure
// 	for ( var i = 0; i < 50; i ++ ) {

// 		var geometry = new THREE.ConeBufferGeometry(2.0, 15, 8, 1, false, 0, 6.3);

// 		var position = new THREE.Vector3();
// 		position.x = Math.random() * 10000 - 5000;
// 		position.y = Math.random() * 6000 - 3000;
// 		position.z = Math.random() * 8000 - 4000;

// 		// TODO need to rotate according to quaternion from mongodb
// 		var rotation = new THREE.Euler();
// 		// rotation.x = Math.random() * 2 * Math.PI;
// 		// rotation.y = Math.random() * 2 * Math.PI;
// 		// rotation.z = Math.random() * 2 * Math.PI;

// 		var scale = new THREE.Vector3(10, 10, 10);

// 		quaternion.setFromEuler( rotation, false );
// 		matrix.compose( position, quaternion, scale );
// 		geometry.applyMatrix( matrix );

// 		var mesh = new THREE.Mesh(geometry);
// 		mesh.material.color.setHex(colorVertex);
// 		// TODO more user data from mongodb to go into this object
// 		mesh.userData = {"type": "vertex"};
// 		scene.add(mesh);

// 		geometriesDrawn.push( geometry );
// 	}

// 	drawEdge(geometriesDrawn);

// }

function onDocumentMouseMove(event) {

	// event.preventDefault();
	mouse.x = ( event.offsetX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.offsetY / window.innerHeight ) * 2 + 1;

}

function onMouseMove(event) {
	mouse.x = event.clientX;
	mouse.y = event.clientY;
}

function onWindowResize(event) {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
}

// animate loop, render the scene
function animate() {
	requestAnimationFrame( animate );
	render();
	stats.update();
}

function render() {
	controls.update();
	// highlight();
	pick();
	renderer.render( scene, camera );
}

function highlight() {

	raycaster.setFromCamera(mouse, camera);

	var intersects = raycaster.intersectObjects(scene.children);

	// intersected
	if ( intersects.length > 0 ) {
		
		// something is intersected previously, need to reset
		if (currentIntersected !== undefined &&
			intersects[0].object !== currentIntersected) {
			resetPrevIntersect(currentIntersected);
		}

		currentIntersected = intersects[0].object;
		highlightIntersect(currentIntersected);

	} else {
		// not intersected, need to reset state if something is intersected previously
		if (currentIntersected !== undefined) {
			resetPrevIntersect(currentIntersected);
		}
		currentIntersected = undefined;
	}
}



// highlight intersected element
function highlightIntersect(currentIntersected) {
	var interType = currentIntersected.userData.type;

	if (interType == "edge") {
		console.log("over edge");
		currentIntersected.material.linewidth = 5;
	} else if (interType == "vertex") {
		console.log("over vertex");
		currentIntersected.material.color.setHex(colorOnSelect);
		
	}
}

// reset previously highlighted element
function resetPrevIntersect(currentIntersected) {
	var interType = currentIntersected.userData.type;
	if (interType == "edge") {
		console.log("reset edge");
		currentIntersected.material.linewidth = 1;
	} else if (interType == "vertex") {
		console.log("reset vertex");
		currentIntersected.material.color.setHex(colorVertex);
	}
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
	console.log("x " + mouse.x
				+ "\ny " + mouse.y);
	renderer.render( pickingScene, camera, pickingTexture );

	//create buffer for reading single pixel

	var pixelBuffer = new Uint8Array( 4 );

	//read the pixel under the mouse from the texture

	renderer.readRenderTargetPixels( pickingTexture, mouse.x, pickingTexture.height - mouse.y, 1, 1, pixelBuffer );

	//interpret the pixel as an ID

	var id = ( pixelBuffer[ 0 ] << 16 ) | ( pixelBuffer[ 1 ] << 8 ) | ( pixelBuffer[ 2 ] );
	var data = pickingData[ id ];
	if ( data) {

		//move our highlightBox so that it surrounds the picked object

		if ( data.position && data.rotation && data.scale ){
			highlightBox.position.copy( data.position );
			highlightBox.rotation.copy( data.rotation );
			highlightBox.scale.copy( data.scale );
			highlightBox.visible = true;
		}

	} else {
		console.log("pick failed");
		highlightBox.visible = false;
	}
}

// construct a fully connected graph
// TODO this should be modified when backend is setup
// TODO use instancing to reduce memory pressure
function drawEdge(geometriesDrawn) {
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
				var lineObject = new THREE.Line(lineGeometry);
				lineObject.material.color.setHex(colorEdge);
				lineObject.userData = {"type": "edge"};
				scene.add(lineObject);
			}
		}
	}
}