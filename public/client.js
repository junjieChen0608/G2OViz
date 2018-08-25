console.log('client running');

const button = document.getElementById('render');
button.addEventListener('click', function(event) {
	console.log('button clicked');
	var graphName = document.getElementById('graphName').value;
	console.log('query graph: ' + graphName);

	fetch('/queryGraph/' + graphName, {method: 'POST'})
	.then(function(response) {
		if (response.ok) {
			console.log('query graph successful');
			return response.json();
		}
		throw new Error('query graph failed');
	})
	.then(function(responseJSON) {
		document.getElementById('mainDiv').innerHTML = JSON.stringify(responseJSON);
	})
	.catch(function(err) {
		document.getElementById('mainDiv').innerHTML = graphName + " not found";
		console.log(err);
	});
});