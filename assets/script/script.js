var loading = false;

var loadingSpinnerContainer = document.getElementById('hotel-search-loading-spinner-container');
var hotelsHeaderContainer = document.getElementById('hotels-container');
var hotelsBodyContainer = document.getElementById('hotels');
var hotelSearchLocationElement = document.getElementById('cityHotel');
var searchForm = document.getElementById('surroundBox');
var searchButton = document.getElementById('searchBtn');
var searchLoadingSpinnerContainer = document.getElementById('hotel-search-loading-spinner-container');
var mapContainer = document.getElementById('map-container');

var apiKey = '37a742acecmshb1d0cea778ef597p1c03a8jsn8195f29d98b6';
var apiHost = 'hotels-com-provider.p.rapidapi.com';

var numberOfHotelsToDisplay = 8;

var apiOptions = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': apiHost,
  }
};

var saveOptions = {
  searchTerms: 0,
  regions: 1,
  hotels: 2,
}

var searchTermsData = {}; // { searchTerm: regionId }
var regionsData = {}; // { regionId: [{id, name}]}
var hotelsData = {}; // { regionId: [hotel+options] }

loadDataFromLocalStorage();
console.log(hotelsData)

function loadDataFromLocalStorage() {
  var localStorageSearchTerms = localStorage.getItem('searchTerms');
  var localStorageRegions = localStorage.getItem('regions');
  var localStorageHotels = localStorage.getItem('hotels');

  if (localStorageSearchTerms !== null) {
    searchTermsData = JSON.parse(localStorageSearchTerms);
  }

  if (localStorageRegions !== null) {
    regionsData = JSON.parse(localStorageRegions);
  }

  if (localStorageHotels !== null) {
    hotelsData = JSON.parse(localStorageHotels);
  }
}

function saveDataToLocalStorage(saveOption) {
  if (saveOption === undefined || saveOption === saveOptions.searchTerms) {
    saveObjectToLocalStorage('searchTerms', searchTermsData);
  }

  if (saveOption === undefined || saveOption === saveOptions.regions) {
    saveObjectToLocalStorage('regions', regionsData)
  }

  if (saveOption === undefined || saveOption === saveOptions.hotels) {
    saveObjectToLocalStorage('hotels', hotelsData);
  }
}

function saveObjectToLocalStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

async function searchLocationForHotels(options = {}) {
  // if script is already processing a previous request, prevent a new request from being processed
  if (loading === true) {
    return;
  }

  var locationName = $('#searchBox').val();

  putPageIntoLoadingState();
  emptyHotelContainers();

  var regionDetails = await getRegionDetailsByLocationName(locationName);
  var hotels = await getHotelsByRegionId(regionDetails.id, options);

  renderHotels(regionDetails.name, hotels, numberOfHotelsToDisplay);

  takePageOutOfLoadingState();

  updateMapWithRenderedHotels(hotels, numberOfHotelsToDisplay);
  scrollToElement(hotelsHeaderContainer);
}

async function getRegionDetailsByLocationName(searchTerm) {
  var regionsDetailsByLocationNameFromLocalStorage = getRegionDetailsByLocationNameFromLocalStorage(searchTerm);

  if (regionsDetailsByLocationNameFromLocalStorage !== undefined) {
    return regionsDetailsByLocationNameFromLocalStorage;
  }

  var url = "https://hotels-com-provider.p.rapidapi.com/v2/regions?query=" + searchTerm + "&domain=AE&locale=en_GB";

  var response = await fetch(url, apiOptions);
  var decodedResponse = await response.json();

  console.log(`Made an API call to retrieve location details for search term: "${searchTerm}".`);

  var regionDetails = {
    name: decodedResponse.data[0].regionNames.primaryDisplayName,
    id: decodedResponse.data[0].gaiaId,
  };

  addSearchTermToLocalStorage(searchTerm, regionDetails.id);
  addRegionDetailsToLocalstorage(regionDetails.id, regionDetails);

  return regionDetails;
}

function addSearchTermToLocalStorage(locationName, regionId) {
  var searchTermTrimmedAndLowercased = locationName.trim().toLowerCase();

  searchTermsData[searchTermTrimmedAndLowercased] = regionId;

  saveDataToLocalStorage(saveOptions.searchTerms);

  console.log(`Saved search term: "${locationName}" to local storage.`)
}

function getRegionDetailsByLocationNameFromLocalStorage(searchTerm) {
  var searchTermTrimmedAndLowercased = searchTerm.trim().toLowerCase();

  var regionIdBySearchTerm = searchTermsData[searchTermTrimmedAndLowercased];

  if (regionIdBySearchTerm === undefined) {
    return undefined;
  }

  console.log(`Search term: "${searchTerm}" retrieved from local storage with regionId: ${regionIdBySearchTerm}.`);

  var regionDetailsByRegionId = regionsData[regionIdBySearchTerm];

  // returns undefined if not found in local storage and can be handled by caller, otherwise returns value found in local storage
  if (regionIdBySearchTerm === undefined) {
    return undefined;
  }

  console.log(`Region details for Region ID: ${regionIdBySearchTerm} retrieved from local storage.`);

  return regionDetailsByRegionId;
}

function addRegionDetailsToLocalstorage(regionId, regionDetails) {
  regionsData[regionId] = regionDetails;

  saveDataToLocalStorage(saveOptions.regions);

  console.log(`Saved region details for Region ID: ${regionId} to local storage.`)
}

async function getHotelsByRegionId(regionId, options = {}) {
  if (options.locale === undefined) {
    options.locale = "en_GB";
  }

  if (options.checkinDate === undefined) {
    options.checkinDate = "2024-09-26";
  }

  if (options.sortOrder === undefined) {
    options.sortOrder = "RECOMMENDED";
  }

  if (options.adultsNumber === undefined) {
    options.adultsNumber = "1"
  }

  if (options.domain === undefined) {
    options.domain = "AE";
  }

  if (options.checkoutDate === undefined) {
    options.checkoutDate = "2024-09-28";
  }

  var hotelsByRegionFromLocalStorage = getHotelsByRegionIdFromLocalStorage(regionId, options);

  if (hotelsByRegionFromLocalStorage !== undefined) {
    return hotelsByRegionFromLocalStorage;
  }

  var url = "https://hotels-com-provider.p.rapidapi.com/v2/hotels/search?region_id=" + regionId
    + "&locale=" + options.locale
    + "&checkin_date=" + options.checkinDate
    + "&sort_order=" + options.sortOrder
    + "&adults_number=" + options.adultsNumber
    + "&domain=" + options.domain
    + "&checkout_date=" + options.checkoutDate;

  var response = await fetch(url, apiOptions);
  var decodedResponse = await response.json();

  var hotels = decodedResponse.properties;

  console.log(`Made API call to retrieve hotels for Region ID: ${regionId} with options: ${JSON.stringify(options)}.`);

  addHotelsToLocalStorage(regionId, hotels, options);

  return hotels;
}

function getHotelsByRegionIdFromLocalStorage(regionId, options) {
  var hotelsKey = createHotelsSearchKey(regionId, options);
  console.log(hotelsKey)
  var hotels = hotelsData[hotelsKey];

  if (hotels === undefined) {
    return undefined;
  }

  console.log(`Hotels for Region ID: ${regionId} with options: ${JSON.stringify(options)} retrieved from local storage.`)

  return hotels;
}

function addHotelsToLocalStorage(regionId, hotels, options) {
  var hotelsKey = createHotelsSearchKey(regionId, options);
  hotelsData[hotelsKey] = hotels;

  saveDataToLocalStorage(saveOptions.hotels);

  console.log(`Saved hotels for Region ID: ${regionId} with options: ${JSON.stringify(options)} to local storage.`)
}

//Modal Functions ------------------------------------------

//Function to convert OpenTripMap API output coordinates for google maps
function convertLonLat(OpenTripMapCoordinateInput) {
  var latitude = OpenTripMapCoordinateInput.lat;
  var longitude = OpenTripMapCoordinateInput.lon;

  var outputForGoogleMaps = {
      lat: latitude,
      lng: longitude
  };

  return outputForGoogleMaps;
};

//--> Initializing variables collecting coordinates of nearby attractions
var restaurantArray = [];
var barArray = [];
var entertainmentArray = [];
var cultureArray = [];



//--> Inputs for "kinds" Parameter for /{lang}/places/radius endpoint 
const cafeRest = "cafes,restaurants";
const barPub = "bars,pubs";
const entertainment = "amusements,sport,casino,theatres_and_entertainments";
const culture = "museums,historic_architecture,towers,historical_places,monuments_and_memorials";

//--> static inputs for /{lang}/places/radius endpoint 
const radius = "10000";
const listLimit = "2";
const minPopularity = "1";
const OpenTripApiKey = "5ae2e3f221c38a28845f05b600eb874f334b70babd7547a89821c944";


//--> Function to call API for a given category
async function fetchData(category, longitude, latitude,){
  const queryURL = `https://api.opentripmap.com/0.1/en/places/radius?radius=${radius}&lon=${longitude}&lat=${latitude}&kinds=${category}&rate=${minPopularity}&format=json&limit=${listLimit}&apikey=${OpenTripApiKey}`;
  return fetch(queryURL)
      .then(function(response) {
          return response.json()
      })
      .then(function(data) {
          //--> for loop iterates through all locations in the response, pushes converted coordinates to respective arrays, and adds new elements to display location names
          for(var location = 0; location < listLimit; location++) {
      
              //--> Switch pushes the coordinates of locations from response to correct array
              switch(category) {
                  case cafeRest:
                      restaurantArray.push({
                          position: convertLonLat(data[location].point),
                          title: data[location].name,
                      })
                          $("#restaurants").append(`<li class="list-group-item">${data[location].name}<span id="locationDistance">   ${Math.round(data[location].dist)}m</span></li>`);
                      break;
                  case barPub:
                      barArray.push({
                          position: convertLonLat(data[location].point),
                          title: data[location].name,
                      })
                      $("#bars_pubs").append(`<li class="list-group-item">${data[location].name}<span id="locationDistance">   ${Math.round(data[location].dist)}m</span></li>`);
                      break;
                  case entertainment:
                      entertainmentArray.push({
                          position: convertLonLat(data[location].point),
                          title: data[location].name,
                      })
                      $("#entertainment").append(`<li class="list-group-item">${data[location].name}<span id="locationDistance">   ${Math.round(data[location].dist)}m</span></li>`);
                      break;
                  case culture:
                      cultureArray.push({
                          position: convertLonLat(data[location].point),
                          title: data[location].name,
                      })
                      $("#culture").append(`<li class="list-group-item">${data[location].name}<span id="locationDistance">   ${Math.round(data[location].dist)}m</span></li>`);
                      break;

              }
          }
      })
}

//Google Maps Initialization function
async function initMap(hotelName, hotelLocation, listLimit) {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary(
  "marker",
  );
  const map = new Map(document.getElementById("googleMap"), {
      zoom: 16,
      center: hotelLocation,
      mapId: "4504f8b37365c3d0",
  });

//--> Creates an info window to share between markers.
  const infoWindow = new InfoWindow();
  
//-->Creates a hotel marker and makes it bigger than default
  const hotelMarker = new PinElement({
      scale: 1.3,
  });
  
  const markerViewScaled = new AdvancedMarkerElement({
      map,
      position: hotelLocation,
      content: hotelMarker.element,
      title: hotelName
  });
  
//--> for loop iterates through categories arrays and creates a marker with a designated custom design
  for(i = 0; i < listLimit; i++){

//----> Restaurant 
      const restaurantImg = document.createElement("img");
      restaurantImg.src = "./assets/images/restaurant_googleMaps_Icon.png";

      const restaurantImgView = new AdvancedMarkerElement({
          map,
          position: restaurantArray[i].position,
          content: restaurantImg,
          title: restaurantArray[i].title,
      });
  
//----> Bars
      const barImg = document.createElement("img");
      barImg.src = "./assets/images/Bar_GoogleMaps_Icon.png";

      const barImgView = new AdvancedMarkerElement({
          map,
          position: barArray[i].position,
          content: barImg,
          title: restaurantArray[i].title,
      });
  
//----> Entertainment
      const entertainmentImg = document.createElement("img");
      entertainmentImg.src = "./assets/images/entertainment_GoogleMaps_Icon.png";
      
      const entertainmentImgView = new AdvancedMarkerElement({
          map,
          position: entertainmentArray[i].position,
          content: entertainmentImg,
          title: entertainmentArray[i].title,
      });

//----> Culture
      const cultureImg = document.createElement("img");
      cultureImg.src = "./assets/images/culture_GoogleMaps_Icon.png";
      
      const cultureImgView = new AdvancedMarkerElement({
          map,
          position: cultureArray[i].position,
          content: cultureImg,
          title: cultureArray[i].title,
      });

//--> Adding a click listener for every marker
  restaurantImgView.addListener("click", createClickListener(restaurantArray[i], restaurantImgView));
  barImgView.addListener("click", createClickListener(barArray[i], barImgView));
  entertainmentImgView.addListener("click", createClickListener(entertainmentArray[i], entertainmentImgView));
  cultureImgView.addListener("click", createClickListener(cultureArray[i], cultureImgView));
  markerViewScaled.addListener("click", createClickListener(markerViewScaled ,markerViewScaled));
  }

//--> Closes any existing info window, sets the content of a new info window, and opens the info window at the position of the clicked marker on the map.
  function createClickListener(location, markerView) {
      return ({ domEvent, latLng }) => {
          const { target } = domEvent;

      infoWindow.close();
      infoWindow.setContent(location.title);
      infoWindow.open(markerView.map, markerView);
      };
  }
}

// Added event listener to clear arrays when modal is closed
$("#myModal").on("hidden.bs.modal", function () {
  // Clear arrays here
  restaurantArray = [];
  barArray = [];
  entertainmentArray = [];
  cultureArray = [];
  $("#restaurants").empty();
  $("#bars_pubs").empty();
  $("#entertainment").empty();
  $("#culture").empty();
  console.log(restaurantArray);
});

//Modal functions end ------------------------------------------------------

function renderHotels(regionName, hotels, numberOfHotelsToDisplay) {
  emptyHotelContainers();

  var hotelContainerHeader = createHotelContainerHeader(regionName);
  $(hotelSearchLocationElement).append(hotelContainerHeader);

  for (var i = 0; i < numberOfHotelsToDisplay; ++i) {
    var hotelCard = createHotelCard(hotels[i]);

    $(hotelsBodyContainer).append(hotelCard);

    //Attached hotelData to card Element
    $(hotelCard).data("hotelDetails", {
      longitude: hotels[i].mapMarker.latLong.longitude,
      latitude: hotels[i].mapMarker.latLong.latitude,
      name: hotels[i].name
    });
  };

//Added event listeners to triger bootstrap modal when hotel card is clicked 
$(".hotelCards").click(function() {
  $("#myModal").modal("show");
  
  var hotelDetails = $(this).data("hotelDetails");
  console.log("----------------\nHotel details of clicked hotel:")
  console.log(hotelDetails)

  //Executing all fetchData functions simultaneously
  Promise.all([
    fetchData(cafeRest,hotelDetails.longitude, hotelDetails.latitude,), 
    fetchData(barPub,hotelDetails.longitude, hotelDetails.latitude,),
    fetchData(entertainment,hotelDetails.longitude, hotelDetails.latitude,),
    fetchData(culture,hotelDetails.longitude, hotelDetails.latitude,),
  ]) 
    //Once the functions are successfully executed, the map is initialized
    .then(() => {
        initMap(hotelDetails.name, { lat: hotelDetails.latitude, lng: hotelDetails.longitude }, listLimit);
    });
  });
};

function createHotelCard(hotel) {
  var hotelContainer = $("<div>").addClass("box hotelCards");

  var hotelTitle = $("<h5>");
  hotelTitle.append(hotel.name);
  hotelContainer.append(hotelTitle);

  var hotelDetailsContainer = $("<div>").addClass("cardDiv")
  hotelContainer.append(hotelDetailsContainer);

  var hotelDetails = "Rating: " + hotel.reviews.score + "/10" + "<br>" + "Price per night: " + hotel.price.lead.formatted;
  hotelDetailsContainer.append(hotelDetails);

  var hotelImage = $("<img>").attr("id", "imageH");
  hotelImage.attr("src", hotel.propertyImage.image.url);
  hotelDetailsContainer.append(hotelImage);

  return hotelContainer;
}

function createHotelContainerHeader(regionName) {
  var hotelHeader = $("<h3>");
  hotelHeader.append("Hotels in " + regionName);

  return hotelHeader;
}

function putPageIntoLoadingState() {
  showElement(loadingSpinnerContainer);
  hideElement(hotelsHeaderContainer);
  hideElement(hotelsBodyContainer);
  searchButton.disabled = true;
  hideElement(mapContainer);

  scrollToElement(searchLoadingSpinnerContainer);

  loading = true;
}

function takePageOutOfLoadingState() {
  hideElement(loadingSpinnerContainer);
  showElement(hotelsHeaderContainer);
  showElement(hotelsBodyContainer);
  searchButton.disabled = false;
  showElement(mapContainer);

  loading = false;
}

function hideElement(element) {
  element.classList.add('d-none');
}

function showElement(element) {
  element.classList.remove('d-none');
}

function emptyElement(element) {
  element.innerHTML = '';
}

function emptyHotelContainers() {
  // emptyElement(hotelsHeaderContainer);
  emptyElement(hotelsBodyContainer);
  emptyElement(hotelSearchLocationElement);
}

function scrollToElement(element) {
  // turn off smooth scroll which interacts weirdly with scrollTop
  document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');

  $('html, body').stop().animate({ // Prevent page being overwhelmed by scroll animations
    scrollTop: $(element).offset().top
  }, 1000, undefined, function () {
    // restore default scroll behavior
    document.documentElement.style.removeProperty('scroll-behavior');
  });
}

function createHotelsSearchKey(regionId, options) {
  var optionsAsSortedArrayToJSONString = convertObjectToArrayOfKeyValuePairsSortedByKeyAsJSONString(options);
  return `${regionId}${optionsAsSortedArrayToJSONString}`;
}

function convertObjectToArrayOfKeyValuePairsSortedByKeyAsJSONString(object) {
  var objectAsArray = Object.entries(object);
  var objectAsSortedArray = objectAsArray.sort(function (a, b) {
    if (a[0] === b[0]) {
      return 0;
    } else if (a[0] > b[0]) {
      return 1;
    } else {
      return -1;
    }
  });

  return JSON.stringify(objectAsSortedArray);
}

$(searchForm).on('submit', function (event) {
  event.preventDefault();
  searchLocationForHotels();
});

$(".dropdown-item").on("click", function (event) {
  event.preventDefault();

  // Update sortOrder when an item is clicked
  sortOrder = $(this).data("index");

  searchLocationForHotels({ sortOrder });
});

/* Maps functionality Start */

var mapMarkers = [];

var map;

function updateMapWithRenderedHotels(hotels, numberOfHotelsToDisplay) {
  var slicedHotels = hotels.slice(0, numberOfHotelsToDisplay);

  resetMap();
  createMapMarkersForHotels(slicedHotels);
  addMarkersToMap();
  fitMapToMarkers();
}

function createMapMarkersForHotels(hotels) {
  mapMarkers = [];

  for (var i = 0; i < hotels.length; ++i) {
    createMapMarker(hotels[i]);
  }
}

function createMapMarker(hotel) {
  var { latitude, longitude } = hotel.mapMarker.latLong;
  var latLng = [latitude, longitude];

  var marker = L.marker(latLng, { title: hotel.name });
  mapMarkers.push(marker);

  var popupElement = document.createElement('div');
  popupElement.textContent = hotel.name;

  var popup = L.popup()
    .setLatLng(latLng)
    .setContent(popupElement);

  marker.bindPopup(popup);
  marker.on('click', function (e) {
    var popup = e.target.getPopup();

  })
}

function addMarkersToMap() {
  for (var i = 0; i < mapMarkers.length; ++i) {
    mapMarkers[i].addTo(map);
  }
}

function fitMapToMarkers() {
  var featureGroup = L.featureGroup(mapMarkers);
  map.fitBounds(featureGroup.getBounds());
}

function resetMap() {
  if (map !== undefined) {
    map.off();
    map.remove();
  }
  map = L.map('map').setView([51.05, -0.09], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
}

/* Maps functionality End */