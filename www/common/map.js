function initMap() {
  mapboxgl.accessToken = 'pk.eyJ1IjoiZm1hcnRpbjIiLCJhIjoiY2syN3Qwc2xtMGphYjNlbWp6aTZjYzJ5MSJ9.DkvVRAZz0lWSRiY2SkdgiQ';
  let map = new mapboxgl.Map({
    container: 'map',
    style: 'https://tilemaps.icgc.cat/tileserver/styles/polit.json',
    center: [2.16859, 41.3954],
    zoom: 12.2,
    maxZoom: 14.8,
  });

  map.on('load', () => {
    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        watchPosition: true
      }
    }));

  });

}