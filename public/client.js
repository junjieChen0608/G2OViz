console.log('client running');

const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	console.log('button clicked');
	var graphName = document.getElementById('graphName').value;

	fetch('/queryGraph/' + graphName, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			console.log('query graph successful');
			document.getElementById('mainDiv').innerHTML = "found " + graphName;
			return;
		}
		throw new Error('query graph failed');
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = "found " + graphName + " not found";
		console.log(err);
	});
});