// ------------------------------------------------------
// VARS

var geolocationSupported = navigator.geolocation;
var deviceMotionSupported = window.DeviceMotionEvent;
var motionOptions = { frequency: 5000}; 
 var geoOptions = {
    timeout: Infinity,
    maximumAge: 10000,
	enableHighAccuracy: true
}; 

var calibrateCompass = window.addEventListener("compassneedscalibration",function(event) {
    // ask user to wave device in a figure-eight motion .   
    event.preventDefault();
    }, true);

var map, gnss, userPosition, Latitude, Longitude, json, user_mail, form_cd, route_cd, accelerationX, accelerationY, accelerationZ;
var crossedPolygons = savedRoute = [];
var motionTimeOut = 0;

// GeoJSON to store the routes and then display them on the map
var routeGeoJson = {};
routeGeoJson.type = "FeatureCollection";
routeGeoJson.features = [];
// Route style
var geojsonRouteOptions = {
    "color": "#2014D0",
    "weight": 3,
    "opacity": 0.65
};

// GeoJSON to store the forms and then display them on the map
var formGeoJson = {};
formGeoJson.type = "FeatureCollection";
formGeoJson.features = [];
// Marker styles
var geojsonMarkerOptions = {
    radius: 5,
    fillColor: "#FF0000",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

// GeoJSON to store the current route and then display it on the map
var currentRouteGeoJson = {};
currentRouteGeoJson.type = "FeatureCollection";
currentRouteGeoJson.features = [];
// GeoJSON to store the current forms and then display them on the map
var currentFormGeoJson = {};
currentFormGeoJson.type = "FeatureCollection";
currentFormGeoJson.features = [];
routeStarted = false;


// ------------------------------------------------------
// FUNCTIONS


// ------------------------------------------------------
// Map functions

// **** Initialize the position catcher ****
function init() {
    let urlOSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let tileOSM = L.tileLayer(urlOSM);
    let lc = L.control.locate({
        drawCircle: false,
        flyTo: true,
        keepCurrentZoomLevel: true,
        setView: 'always',
        locateOptions: {
            enableHighAccuracy: true
        }
    });
    map = L.map("map", {
        center: [41.398428, 2.166566],
        zoom: 12,
    });

    tileOSM.addTo(map);
    lc.addTo(map);	 

    // Check if already exists a route. If not, create one
	let routeExists = readSavedRoute();   
	if (!routeExists) {
        get_route_cd();
    }
	checkDeviceMotion();   // Check the devide motion
	checkGeoLocation();   // Check the user geolocation
}

// **** Initialize the user map ****
function map() {
    let urlOSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let tileOSM = L.tileLayer(urlOSM);
    let lc = L.control.locate({
        drawCircle: false,
        flyTo: true,
        keepCurrentZoomLevel: true,
        setView: 'always',
        locateOptions: {
            enableHighAccuracy: true
        }
    });
    map = L.map("map", {
        center: [41.398428, 2.166566],
        zoom: 12,
    });


    tileOSM.addTo(map);
    lc.addTo(map); 

    draw_route(map, routeGeoJson, geojsonRouteOptions);   // Draw the routes made by the user
    draw_points(map, formGeoJson, geojsonMarkerOptions);   // Draw the forms made by the user
}


// ------------------------------------------------------
// Motion & location functions

function checkGeoLocation() {
     // check for geolocation support
    if (geolocationSupported) {
        checkPosition();
    } else {
        alert("El posicionament no està suportat")
    }
}


function checkDeviceMotion() {
    // check if device events are supported in the browser
    if (deviceMotionSupported) {
        // starts catching motion
        window.addEventListener('devicemotion', motionHandler, motionOptions);
    } else {
        alert("L'accés a l'acceleròmetre no està suportat");
    }
}

// **** Function to handle the device motion event ****
function motionHandler() {
    accelerationX = Math.round(parseFloat(event.acceleration.x));
    accelerationY = Math.round(parseFloat(event.acceleration.y));
    accelerationZ = Math.round(parseFloat(event.acceleration.z));
    
    // If the user is moving...
    if (accelerationX > 1 || accelerationY > 1 || accelerationZ > 1) {
		routeStarted = true;
        motionTimeOut = 0;
    }
    // If the user have stopped and the route's initalized...
	else if (routeStarted) {
		if (accelerationX <= 0 && accelerationY <= 0 && accelerationZ <= 0) {
			motionTimeOut += 1;
		}
		if (motionTimeOut == 1500) {  // 30 segundos
            motionTimeOut = 0;
            saveCoordinates(Longitude, Latitude)
			location.href="stopDialog.html";
		}
	}
}

// **** Function to check the user location ****
function checkPosition() {
	function geoSuccess(position) {
        userPosition = position;
        let userCoords;
        Latitude = userPosition.coords.latitude;
        Longitude = userPosition.coords.longitude;
        userCoords = [Longitude, Latitude];
        Location = turf.point(userCoords);
        saveCoordinates(Longitude, Latitude)
        //Location = turf.point([2.158630, 41.369104])   // Punto de prueba
		draw_current_route(map, currentRouteGeoJson, geojsonRouteOptions);   // Draw the current route
		draw_current_forms(map, currentFormGeoJson, geojsonMarkerOptions);   // Draw the current forms

        savePosition(userCoords);   // Save the coordinate in a JSON
        CheckIsInside(Location);   // Check if the user is inside and interest polygon
    }
	function geoError(error) {
        alert("S'ha donat un error i no es pot geolocalitzar el dispositiu")
	}
    // Start watching the location
	gnss = navigator.geolocation.watchPosition(geoSuccess, geoError, geoOptions);
}

// **** Function to check if the user is inside an interest polygon ****
function CheckIsInside(point){
    let isInside;
    for (poly of polygons.features) {
        polyID = poly.properties.OBJECTID;
        isInside = turf.inside(point, poly);
        // if the user is inside...
        if (isInside) {
            crossedPolygons = readCrossedPolygon();
            if (!crossedPolygons) {
                // If the JSON doesn't exists
                polyArray = []
                saveCrossedPolygon(polyArray);
            } else {
                // Check if the user already have entered the polygon
                if (crossedPolygons.indexOf(polyID) < 0) {
                    crossedPolygons.push(polyID);   // Push the current polygon to the array
                    saveCrossedPolygon(crossedPolygons);
                    saveCoordinates(Longitude, Latitude)
                    location.href="form1.html";
                }
            }       
        }
    }
}


// -----------------------------------------------------------------
// Save and get data

// **** Function to save the current position in a JSON ****
function savePosition(coordsArray) {

    savedRoute = readSavedRoute();

    if (!savedRoute) {
        // If the JSON doesn't exists
        savedRoute = saveRoute([coordsArray]);
    } else {
        // If the JSON exists
        savedRoute.push(coordsArray);
        saveRoute(savedRoute);
    }
}

// **** Function to send the route to the database ****
function sendRoute() {
    
    savedRoute = readSavedRoute();
    json = {"coordinates": savedRoute}
    json = JSON.stringify(json);
    user_mail = localStorage.getItem('user-mail');
    route_cd = localStorage.getItem('route-cd');

    if (navigator.onLine)   // Check Internet connection
    {
        $.ajax({
            type:'POST',
            url: 'http://158.109.128.158/gemott/send_route.php',
            data: {'route': json, 'user_mail': user_mail, 'route_cd': route_cd},
            success: function (response) {
                // Restart vars & arrays
                restart_vars();
				navigator.geolocation.clearWatch(gnss);
                alert("Ruta enviada correctament");
				location.href="menu.html";
            },
            error: function() {
                alert("Error en la petició");
            }
        });
    }
    else
    {
        alert ("No tens connexió, no s'han pogut enviar els registres");
    }
}

// **** Function to save a form ***
function save_form() {

    user_mail = localStorage.getItem('user-mail');
    route_cd = localStorage.getItem('route-cd');
    let Lat = localStorage.getItem('Latitud');
    let Lng = localStorage.getItem('Longitud');
    
    if (navigator.onLine)  // Check Internet connection
    {
        $.ajax({
            type: 'post',
            url: 'http://158.109.128.158/gemott/form.php', 
            data: {'user_mail': user_mail, 'route_cd': route_cd, 'form_lat': Lat, 'form_lng': Lng},
            success: function() {
                localStorage.removeItem('Latitud');
                localStorage.removeItem('Longitud');
                get_form_cd();   // Get the current form cd 
            }
        })
    }
    else
    {
        alert ("No tens connexió, no s'ha pogut enviar la resposta");
    } 
}

// **** Function to save the first question ****
function save_quest_1() {

    let ans1 = $('input[name=quest1]:checked').val();
    form_cd = localStorage.getItem('form-cd');

    if (navigator.onLine)  // Check Internet connection
    {
        $.ajax({
            type: 'post',
            url: 'http://158.109.128.158/gemott/quest1.php', 
            data: {'quest1_ans': ans1, 'form_cd': form_cd} ,
            success: function(){
                location.href="form2.html"
            },
            error: function() {
                alert("Error al enviar la resposta");
            }
        });
    }
    else
    {
        alert ("No tens connexió, no s'ha pogut enviar la resposta");
    }
}

// **** Function to save the second question ****
function save_quest_2() {

    // Create an array with the values checked in the checkbox
    var ans2 = [];
    var form = document.getElementById("form2");
    var selecteds = form.getElementsByTagName("INPUT");
    for (i=0; i < selecteds.length; i++) {
        if (selecteds[i].checked) {
            ans2.push(selecteds[i].value)
        }
    }
    form_cd = localStorage.getItem('form-cd');
    
    if (navigator.onLine)
    {
        $.ajax({
            type: 'post',
            url: 'http://158.109.128.158/gemott/quest2.php',
            data: {'quest2_ans[]': ans2, 'form_cd': form_cd},
            success: function(response){
                localStorage.removeItem('form-cd');
                location.href="index.html"
            },
            error: function() {
                alert("Error al enviar la resposta");
            }
        })
    }
    else
    {
        alert ("No tens connexió, no s'ha pogut enviar la resposta");
    }
}


// -----------------------------------------------------------------
// Validate forms - Log in + Sign in + Log out

// **** Function to validate the mail ****
function validateMail(field) {
    if (
        !(
            (field.indexOf(".") > 0) && (field.indexOf("@") > 0 )
        ) ||
        /[^a-zA-Z0-9.@_-]/.test(field)
    ) {
        return("El correu no es vàlid")
    } else {
        return false
    }
}

// **** Function to validate the password ****
function validatePassword(field) {
    if (field.length < 5) {
        return("La contrasenya ha de tenir com a mínim 5 caràcters\n")
    } else if (!/[a-z]/.test(field) || !/[0-9]/.test(field)) {
        return("La contrasenya requereix de caràcters a-z i 0-9\n")
    } else {
        return false
    }
}


// **** Function to sign in the user
function registry() {
    let mail_input = $("#mail-sign").val();
    let psw_input = $("#psw-sign").val();

    //let age_input = $('#age').val();
    //let gen_input = $('input[name=gen]:checked').val();

    // Validate the sign in data
    let mailFail = validateMail(mail_input);
    let pswFail = validatePassword(psw_input);

    if (!mailFail && !pswFail) {
        $.ajax({
            type: 'post',
            url: 'http://158.109.128.158/gemott/registry.php', 
            //data: {'mail': mail_input, 'psw': psw_input, 'age': age_input, 'gen': gen_input},
            data: {'mail': mail_input, 'psw': psw_input},
            success: function(response){
                if (response == true) {
                    location.href="login.html"
                } else {
                    let error = response;
                    document.getElementById('error-text-signin').innerHTML = error;
                }
            },
            error: function(response) {
                document.getElementById('error-text-signin').innerHTML = "No s'ha pogut registrar";
            }
        });
    } else if (!mailFail && pswFail) {
        document.getElementById('error-text-signin').innerHTML = pswFail;
    } else if (mailFail && !pswFail) {
        document.getElementById('error-text-signin').innerHTML = mailFail;
    } else if (mailFail && pswFail) {
        document.getElementById('error-text-signin').innerHTML = mailFail + " i " + pswFail.toLowerCase();
    } 
}


// **** Function to login the user ****
function authenticate() {
    mail_input = $('#mail').val();
    psw_input = $('#psw').val();

    $.ajax({
        type: 'post',
        url: 'http://158.109.128.158/gemott/autenthicate.php', 
        data: 'mail=' + mail_input + '&psw=' + psw_input,
        success: function(response){
            if (response == true) {
                // Check if exists an user session. If exists, removes it
                let userExists = localStorage.getItem('user-mail');
                if (userExists) {
                    localStorage.removeItem('user-mail')
                };
                catchUserData(mail_input);
                location.href="menu.html"
            } else {
                document.getElementById('error-text').innerHTML = "Credencials incorrectes";
            }
        },
        error: function() {
            document.getElementById('error-text').innerHTML = "Error de connexió";
        }
    });
}


// **** Function to logout the user ****
function logout() {
    // Removes and restart every user-data variable
    localStorage.removeItem('user-mail');
    restart_vars();
    $.mobile.changePage("login.html", {transition: "slideup"})
}


// -----------------------------------------------------------------
// Change pages

// **** Function to change page to map ****
function changePageToMap() {
    $.mobile.changePage("map.html", {transition: "pop", reloadPage: true});
}

// **** Function to change page to index ****
function changePageToIndex() {
    location.href="index.html"
}

// **** Function to return to menu from index ****
function returnToMenu() {
	restart_vars();
	navigator.geolocation.clearWatch(gnss)
	location.href="menu.html";
}


// -----------------------------------------------------------------
// Get & delete info

// **** Function to catch the user mail ***
function catchUserData(mail) {
    localStorage.setItem('user-mail', mail);
}

// **** Function to return the user statistics ****
function get_statistics() {

    user_mail = localStorage.getItem('user-mail');
    let totalDistance = 0;

    // Get the data about forms answered and routes made 
    $.ajax({
        type: 'get',
        url: 'http://158.109.128.158/gemott/statistics.php',
        data: {'user_mail': user_mail},
        success: function(response) {
            let statistics = JSON.parse(response);
            if (statistics) {
                let forms_answered = statistics[0];
                let routes_made = statistics[1];
                document.getElementById('forms-answered').innerHTML = forms_answered;
                document.getElementById('routes-registered').innerHTML = routes_made;
            } 
        }
    })

    // Get the data about the total distance walked in Km
    $.ajax({
        type: 'get',
        url: 'http://158.109.128.158/gemott/load_routes.php',
        data: {'user_mail': user_mail},
        success: function(response) {
            totalDistance = parseInt(0);
            let data = JSON.parse(response);
            if (data) {
                for (i=0; i<data.length; i++) {
                    let geojson = JSON.parse(data[i]);
                    let coordinates = geojson['coordinates'];
                    if (coordinates) {
                        let from = turf.point(coordinates[0])
                        let to = turf.point(coordinates.slice(-1)[0])
                        let distance = turf.distance(from, to);
                        distance = distance.toFixed(2);
                        distance = parseFloat(distance)
                        totalDistance += distance;
                    }
                }
                totalDistance.toFixed(2);
            }
            document.getElementById('total-distance').innerHTML = totalDistance + '<span> km </span>';
        }
    })
}

// **** Function to restart every user-data variable ****
function restart_vars() {
	routeStarted = false;
    savedRoute =  [];
	localStorage.removeItem('crossed-polygons');
    localStorage.removeItem('user_route.json');
    localStorage.removeItem('route-cd');
    json = "";
}

// **** Function to send the current route to the database and get the route cd ****
function get_route_cd() {

    user_mail = localStorage.getItem('user-mail');

    $.ajax({
        type: 'POST',
        url: 'http://158.109.128.158/gemott/get_route.php',
        data: {'user-mail': user_mail},
        success: function(response) {
            localStorage.setItem('route-cd', response)
        },
        error: function() {
            alert("No s'ha pogut iniciar el registre")
        }
    })
}

// **** Function to get the current form cd ****
function get_form_cd() {
    
    $.ajax({
        type: 'post',
        url: 'http://158.109.128.158/gemott/get_form.php',
        success: function(response) {
            localStorage.setItem('form-cd', response);
            save_quest_1();   // Save the quest
        }  
    })
}

// -----------------------------------------------------------------
// Draw points & routes

// **** Function to draw the routes made ****
function draw_route(mapObj, routeGeoJSON, routeStyle) {
    
    user_mail = localStorage.getItem('user-mail');

    $.ajax({
        type: 'get',
        url: 'http://158.109.128.158/gemott/load_routes.php',
        data: {'user_mail': user_mail},
        success: function(response){
            let data = JSON.parse(response);   // Data from the database
			if (data) {
				for (i=0; i<data.length; i++) {
					let geojson = JSON.parse(data[i]);
                    let coordinates = geojson['coordinates'];
                    if (coordinates) {
                        let from = turf.point(coordinates[0])
                        let to = turf.point(coordinates.slice(-1)[0])
                        let distance = turf.distance(from, to);
                        distance = distance.toFixed(2);
                        
                        // Create the route input to draw
                        let routeInput = {};
                        routeInput['type'] = 'Feature';
                        routeInput['properties'] = {'Distance': distance};
                        routeInput['geometry'] = {'type': 'LineString',
                                            'coordinates': coordinates
                                            };
                        routeGeoJSON['features'].push(routeInput);
                        
                        // Draw the routes
                        L.geoJSON(routeGeoJSON, {
                            style: routeStyle,
                        onEachFeature: function (feature, layer) {
                            layer.bindPopup('<span>Distància: </span>' + feature.properties.Distance + '<span> Km </span>' )
                        }
                        }).addTo(mapObj);
                    }
				}
			}
        }
    })
}

// **** Function to draw the forms answered ****
function draw_points(mapObj, pointGeoJSON, markerStyle) {

    user_mail = localStorage.getItem('user-mail');
    
    $.ajax({
        type: 'GET',
        url: 'http://158.109.128.158/gemott/load_points.php',
        data: {'user_mail': user_mail},
        success: function(response){
            let pointData = JSON.parse(response);
			if (pointData) {
				for (i=0;i<pointData.length; i++) {
					let formData = pointData[i];
					let formCoordinates = [formData[0], formData[1]];
                    let formQuest2Num = formData[3];
                    // Translate the numbers returned from the database to an specific string
					let translate = {"1": "Arbres i plantes", "2": "Comerços", "3":"Bancs i mobiliari", "4": "Estat de les voreres",
						"5": "Gent", "6": "Trànsit", "7": "Soroll", "8": "Olor", "9": "Il·luminació", "10": "Neteja", "11": "Altres"};
					let formQuest2 = formQuest2Num.map(x=>translate[x]);
					let pointInput = {};
					
					switch (formQuest1 = formData[2]) {
						case formQuest1 = "1":
							formQuest1 = "Molt bé";
							break;
						case formQuest1 = "2":
							formQuest1 = "Bé";
							break;
						case formQuest1 = "3":
							formQuest1 = "Indiferent";
							break;
						case formQuest1 = "4":
							formQuest1 = "Malament";
							break;
						case formQuest1 = "5":
							formQuest1 = "Molt malament";
							break;
                    }
                    
                    // Create the point input to draw
					pointInput['type'] = 'Feature';
					pointInput['properties'] = {'Ans1': formQuest1,
												'Ans2': formQuest2
												}
					pointInput['geometry'] = {'type': 'Point',
												'coordinates': formCoordinates
												};
					pointGeoJSON['features'].push(pointInput);

                    // Draw the forms
					L.geoJSON(pointGeoJSON, {
						pointToLayer: function (feature, latlng) {
							return L.circleMarker(latlng, markerStyle)
						},
						onEachFeature: function (feature, layer) {
							layer.bindPopup('<span>Com et sents?: </span>' + feature.properties.Ans1 
											+ '<br> <span>Per què?: </span>' + feature.properties.Ans2)
						}
					}).addTo(mapObj); 
				}
			} 
        }
    })
}

// **** Function to draw the current user route ****
function draw_current_route(mapObj, GeoJson, style) {
    var currentRouteCoordinates = readSavedRoute();   // Get the route data stored
	if (currentRouteCoordinates) {
		// Create a geojson to draw the current route
		GeoJson = {};
		GeoJson.type = "FeatureCollection";
		GeoJson.features = [];
		let currentRouteInput = {};
		currentRouteInput['type'] = 'Feature';
		currentRouteInput['geometry'] = {'type': 'LineString',
										'coordinates': currentRouteCoordinates
										};
		GeoJson['features'].push(currentRouteInput);

        // Draw the route
		L.geoJSON(GeoJson, {
			style: style,
			}).addTo(mapObj); 
	}
}

// **** Function to draw the current user forms answered ****
function draw_current_forms(mapObj, GeoJson, style) {
    route_cd = localStorage.getItem('route-cd');

    $.ajax({
        method: 'get',
        url: 'http://158.109.128.158/gemott/load_current_form.php',
        data: {'route-cd': route_cd},
        success: function(response) { 
            let currentForms = JSON.parse(response);
			if (currentForms) {
                for (i=0;i<currentForms.length; i++) {
                    let formData = currentForms[i];
                    let formCoordinates = [formData[0], formData[1]];
                    // Create the point input to draw
                    let pointInput = {};
                    pointInput['type'] = 'Feature';
                    pointInput['geometry'] = {'type': 'Point',
                                                'coordinates': formCoordinates
                                                };
                    GeoJson['features'].push(pointInput);

                    // Draw the current route forms
                    L.geoJSON(GeoJson, {
                        pointToLayer: function (feature, latlng) {
                            return L.circleMarker(latlng, style)
                        }
                    }).addTo(mapObj);
                }
			}
        }
    })
}


// -----------------------------------------------------------------
// LocalStorage

// **** Read the crossed polygons array ****
function readCrossedPolygon() {
    return JSON.parse(localStorage.getItem('crossed-polygons'));
}

// **** Save the crossed polygons array ****
function saveCrossedPolygon(polygonID) {
    localStorage.setItem('crossed-polygons', JSON.stringify(polygonID));
}

// **** Read the saved route ****
function readSavedRoute() {
    return JSON.parse(localStorage.getItem('user_route.json'));
}

// **** Save the current route ****
function saveRoute(coordsArray) {
    localStorage.setItem('user_route.json', JSON.stringify(coordsArray));
}

// **** Save the current coordinates ****
function saveCoordinates(Long, Lat) {
    latitudeExists = localStorage.getItem('Latitud')
    longitudeExists = localStorage.getItem('Longitude')

    if (latitudeExists) {
        localStorage.removeItem('Latitud')
    }
    localStorage.setItem('Latitud', JSON.stringify(Latitude));
    if (longitudeExists) {
        localStorage.removeItem('Longitud')
    }
    localStorage.setItem('Longitud', JSON.stringify(Longitude));
}
