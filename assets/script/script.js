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

function renderHotels(regionName, hotels, numberOfHotelsToDisplay) {
  emptyHotelContainers();

  var hotelContainerHeader = createHotelContainerHeader(regionName);
  $(hotelSearchLocationElement).append(hotelContainerHeader);

  for (var i = 0; i < numberOfHotelsToDisplay; ++i) {
    var hotelCard = createHotelCard(hotels[i]);

    $(hotelsBodyContainer).append(hotelCard);
  }
}

function createHotelCard(hotel) {
  var hotelContainer = $("<div>").addClass("box");

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