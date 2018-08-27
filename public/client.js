/******************************************* client-side **************************************************/
console.log('client running');

const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	counter = 0;
	console.log('button clicked');
	var graphName = document.getElementById('graphName').value;
	if (graphName[0] == '/') {
		graphName = replaceSlash(graphName);
	}
	console.log('query graph: ' + graphName);

	fetch('/queryGraph/' + graphName, {method: 'GET'})
	.then(function(response) {
		if (response.ok) {
			console.log('query graph successful');
			return response.json();
		}
		throw new Error('query graph failed');
	})
	.then(function(responseJSON) {
		console.log("rendering response");
		document.getElementById('mainDiv').innerHTML = JSON.stringify(responseJSON[0]);
		// document.getElementById('mainDiv').innerHTML = "done";
		console.log("rendering finished");
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
});


function replaceSlash(input) {
	console.log("replacing slash for " + input);
	return input.replace(/\//g, '%2F');
}

/******************************************* three.js **************************************************/

var container, stats;
var camera, controls, scene, renderer;
var raycaster;
var currentIntersected;

var mouse = new THREE.Vector2();

var color = new THREE.Color();
var colorVertex = 0x135cd3;
var colorEdge = 0x7f0026;
var colorOnSelect = 0xefdc04;

var startTime = Date.now();
// init();
// animate();

function init() {

	container = document.getElementById( "container" );

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 100000);
	camera.position.z = 1000;

	controls = new THREE.TrackballControls( camera );
	controls.rotateSpeed = 1.0;
	controls.zoomSpeed = 1.2;
	controls.panSpeed = 0.8;
	controls.noZoom = false;
	controls.noPan = false;
	controls.staticMoving = true;
	controls.dynamicDampingFactor = 0.3;

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xd8d8d8);
	scene.add( new THREE.AmbientLight( 0x555555 ) );

	var light = new THREE.SpotLight( 0xffffff, 1.5 );
	light.position.set( 0, 500, 2000 );
	scene.add( light );

	var geometriesDrawn = [];

	var matrix = new THREE.Matrix4();
	var quaternion = new THREE.Quaternion();

	// generate n random geometries to the scene
	// this should be changed to load vertex from MongoDB
	for ( var i = 0; i < 50; i ++ ) {

		var geometry = new THREE.ConeBufferGeometry(2.0, 15, 8, 1, false, 0, 6.3);

		var position = new THREE.Vector3();
		position.x = Math.random() * 10000 - 5000;
		position.y = Math.random() * 6000 - 3000;
		position.z = Math.random() * 8000 - 4000;

		// TODO need to rotate according to quaternion from mongodb
		var rotation = new THREE.Euler();
		// rotation.x = Math.random() * 2 * Math.PI;
		// rotation.y = Math.random() * 2 * Math.PI;
		// rotation.z = Math.random() * 2 * Math.PI;

		var scale = new THREE.Vector3(10, 10, 10);

		quaternion.setFromEuler( rotation, false );
		matrix.compose( position, quaternion, scale );
		geometry.applyMatrix( matrix );

		var mesh = new THREE.Mesh(geometry);
		mesh.material.color.setHex(colorVertex);
		// TODO more user data from mongodb to go into this object
		mesh.userData = {"type": "vertex"};
		scene.add(mesh);

		geometriesDrawn.push( geometry );
	}

	drawEdge(geometriesDrawn);

	raycaster = new THREE.Raycaster();
	raycaster.linePrecision = 3;

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	stats = new Stats();
	container.appendChild( stats.dom );

	renderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
}

function onDocumentMouseMove(event) {

	// event.preventDefault();

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

}

// animate loop, render the scene
var frameID;
function animate() {
	frameID = requestAnimationFrame( animate );
	render();
	stats.update();
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

function render() {
	controls.update();
	highlight();
	renderer.render( scene, camera );
}

// construct a fully connected graph
// TODO this should be modified when backend is setup
function drawEdge(geometriesDrawn) {
	for (var i = 0; i < geometriesDrawn.length; ++i) {
		var vi = geometriesDrawn[i];
		var posI = vi.attributes.position.array;

		for (var j = 0; j < geometriesDrawn.length; ++j) {
			if (i != j) {
				var vj = geometriesDrawn[j];
				var posJ = vj.attributes.position.array;
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