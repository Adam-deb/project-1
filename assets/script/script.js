var appVersion = '2024-02-10 00:09';

var loading = false;
var jumbotronDocked = false;

var loadingSpinnerContainer = document.getElementById('hotel-search-loading-spinner-container');
var jumbotronContainer = document.getElementById('jumbotron-container');
var jumbotron = document.getElementById('jumbotron');

var hotelsToolbarContainer = document.getElementById('hotels-toolbar-container');

var hotelSearchLocationElement = document.getElementById('hotels-location');
var hotelSearchForm = document.getElementById('hotel-search-form');
var hotelSearchButton = document.getElementById('hotel-search-button');
var hotelSearchBox = document.getElementById('hotel-search-box');
var hotelSearchIcon = document.getElementById('hotel-search-icon');

var hotelsHeaderContainer = document.getElementById('hotels-header-container');
var hotelsBodyContainer = document.getElementById('hotels-container');

var hotelsHeaderWrapper = document.getElementById('hotels-header-wrapper');
var hotelsHeaderImage = document.getElementById('hotels-header-image');
var hotelsHeaderDetails = document.getElementById('hotels-header-details');

var hotelsWidgetsContainer = document.getElementById('hotels-widgets-container');

var apiKey = '3b7528a7d9msh7b3890b03ac5fa0p1b4094jsnecb6de0ea8d7';
var apiHost = 'hotels-com-provider.p.rapidapi.com';

var corsProxyURLPrefix = 'https://corsproxy.io/?';

var hotelMapMarkers = {};

var numberOfHotelsToDisplayPerPage = 7;

var currentSearchLocation = undefined;

var map;
var modalMap;
var mapContainer;

//--> Creates an info window to share between markers.
var infoWindow;

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
  images: 3,
  recommendations: 4,
}

var searchTermsData = {}; // { searchTerm: regionId }
var regionsData = {}; // { regionId: [{id, name}]}
var hotelsData = {}; // { regionId: [hotel+options] }
var imagesSearchData = {}; // { keyword: [{src, avgColor}] }
var recommendationsData = {}; // { "lat,lon": [{category: placeToGo}] }

loadDataFromLocalStorage();

function loadDataFromLocalStorage() {
  var localStorageVersion = localStorage.getItem('appVersion');

  if (localStorageVersion !== appVersion) {
    localStorage.clear();
    localStorage.setItem('appVersion', appVersion);
    return;
  }

  var localStorageSearchTerms = localStorage.getItem('searchTerms');
  var localStorageRegions = localStorage.getItem('regions');
  var localStorageHotels = localStorage.getItem('hotels');
  var localStorageImages = localStorage.getItem('images');
  var localStorageRecommendations = localStorage.getItem('recommendations');

  if (localStorageSearchTerms !== null) {
    searchTermsData = JSON.parse(localStorageSearchTerms);
  }

  if (localStorageRegions !== null) {
    regionsData = JSON.parse(localStorageRegions);
  }

  if (localStorageHotels !== null) {
    hotelsData = JSON.parse(localStorageHotels);
  }

  if (localStorageImages !== null) {
    imagesSearchData = JSON.parse(localStorageImages);
  }

  if (localStorageRecommendations !== null) {
    recommendationsData = JSON.parse(localStorageRecommendations);
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

  if (saveOption === undefined || saveOption === saveOptions.images) {
    saveObjectToLocalStorage('images', imagesSearchData);
  }

  if (saveOption === undefined || saveOption === saveOptions.recommendations) {
    saveObjectToLocalStorage('recommendations', recommendationsData);
  }
}

function saveObjectToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    localStorage.removeItem(key);
  }
}

async function searchLocationForHotels(options = {}, overrideLocation) {
  // if script is already processing a previous request, prevent a new request from being processed
  if (loading === true) {
    console.log('Currently loading. New search attempt was rejected.');
    return;
  }

  if (overrideLocation !== undefined) {
    hotelSearchBox.value = overrideLocation;
  }

  console.log(options)

  if (currentSearchLocation === undefined || options.searchType === 'search') {
    currentSearchLocation = hotelSearchBox.value;
  }

  console.log(currentSearchLocation)

  try {
    hotelSearchBox.blur();

    putPageIntoLoadingState();

    await simulateNetworkCall();

    var regionDetails = await getRegionDetailsByLocationName(currentSearchLocation);

    var regionImageSearchString = `${regionDetails.name}`;
    var [hotels, weatherWidgets, regionImage] = await Promise.all(
      [
        getHotelsByRegionId(regionDetails.id, options),
        createWeatherWidgets(regionDetails.coordinates),
        getImagesBasedOnString(regionImageSearchString),
      ]
    );
  } catch (error) {
    hotelSearchBox.value = 'Error: please try again'
    takePageOutOfLoadingState(false);

    return false;
  }

  // console.log(regionImage)

  colorWeatherWidgetsByBackgroundColor(weatherWidgets, regionImage.avgColor);
  emptyHotelContainers();
  renderHotels(regionDetails.name, weatherWidgets, regionImage, hotels, numberOfHotelsToDisplayPerPage);
  takePageOutOfLoadingState();
  updateMapWithRenderedHotels(hotels, numberOfHotelsToDisplayPerPage);
  scrollToElement(jumbotronContainer);

  return true;
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
    coordinates: {
      lat: decodedResponse.data[0].coordinates.lat,
      lon: decodedResponse.data[0].coordinates.long // api uses 'long' we use 'lon'
    }
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

  var hotels = decodedResponse.properties || [];

  console.log(`Made API call to retrieve hotels for Region ID: ${regionId} with options: ${JSON.stringify(options)}.`);

  addHotelsToLocalStorage(regionId, hotels, options);

  return hotels;
}

function getHotelsByRegionIdFromLocalStorage(regionId, options) {
  var hotelsKey = createHotelsSearchKey(regionId, options);
  // console.log(hotelsKey)
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

function renderHotels(regionName, weatherWidgets, regionImage, hotels, numberOfHotelsToDisplay = numberOfHotelsToDisplayPerPage) {
  emptyHotelContainers();
  createHotelContainerHeader(regionName, weatherWidgets, regionImage);
  if (hotels.length === 0) {
    hotelsBodyContainer.innerHTML = `<div class="text-center">0 results</div>`;
    return;
  }

  createHotelGrid(hotels.slice(0, Math.min(numberOfHotelsToDisplay, hotels.length)));
}

function createHotelGrid(hotels, columns = 4) {
  createGridTemplateAreasString(hotels, columns);
  hotelsBodyContainer.style.gridTemplateColumns = createGridTemplateColumnsString(columns);

  createMapContainer();
  hotelsBodyContainer.appendChild(mapContainer);

  for (var i = 0; i < hotels.length; ++i) {
    var hotelCard = createHotelCard(hotels[i], i);
    hotelsBodyContainer.appendChild(hotelCard);
  }
}

function createGridTemplateAreasString(hotels, columns) {
  var gridTemplateAreas = [];
  var gridTemplateAreasSmallerScreens = [];
  var mapColumnSpan = 2;
  var mapRowSpan = 3;

  var hotelIndex = 0;
  var hotelIndexSmallScreen = 0;

  // Hotels appear before map on small screens
  while (hotelIndexSmallScreen < hotels.length) {
    var templateRowSmallScreen = [];

    if (hotelIndexSmallScreen < hotels.length) {
      templateRowSmallScreen.push(`hotel-${hotelIndexSmallScreen}`);
      templateRowSmallScreen.push(`hotel-${hotelIndexSmallScreen}`);
      templateRowSmallScreen.push(`hotel-${hotelIndexSmallScreen}`);
      templateRowSmallScreen.push(`hotel-${hotelIndexSmallScreen}`);

      gridTemplateAreasSmallerScreens.push(templateRowSmallScreen);
    }

    hotelIndexSmallScreen += 1;
  }

  for (var i = 0; i < mapRowSpan; ++i) { // create a square space spanning mapSpan x mapSpan rows and columns in the top right of the grid
    var templateRow = [];
    var templateRowSmallScreen = [];

    for (var j = 0; j < columns; ++j) {
      templateRowSmallScreen.push('map');
    }

    for (var j = 0; j < columns; ++j) {
      if (j >= columns - mapColumnSpan) {
        templateRow.push('map');
      } else if (hotelIndex >= hotels.length) {
        templateRow.push('.');
      } else {
        templateRow.push(`hotel-${hotelIndex}`);
        templateRow.push(`hotel-${hotelIndex}`);

        hotelIndex += 1;
        ++j;
      }
    }

    gridTemplateAreas.push(templateRow);
    gridTemplateAreasSmallerScreens.push(templateRowSmallScreen);
  }

  while (hotelIndex < hotels.length) { // fill the rest of the grid with remaining hotels that need to be rendered
    var templateRow = [];

    for (var i = 0; i < columns / 2; ++i) {
      if (hotelIndex + i < hotels.length) {
        templateRow.push(`hotel-${hotelIndex + i}`);
        templateRow.push(`hotel-${hotelIndex + i}`);
      } else {
        templateRow.push('.');
        templateRow.push('.');
      }
    }

    gridTemplateAreas.push(templateRow);

    hotelIndex += columns / 2;
  }

  var gridTemplateAreasString = '';

  for (var i = 0; i < gridTemplateAreas.length; ++i) {
    gridTemplateAreasString += `"${gridTemplateAreas[i].join(' ')}"`;

    if (i !== gridTemplateAreas.length - 1) {
      gridTemplateAreasString += '\n';
    }
  }

  var gridTemplateAreasString = createGridTemplateAreasStringFromGridTemplateAreas(gridTemplateAreas);
  var gridTemplateAreasSmallerScreensString = createGridTemplateAreasStringFromGridTemplateAreas(gridTemplateAreasSmallerScreens);

  // console.log(gridTemplateAreasString);

  // Add the grid template areas styles to the document head because media queries cannot be applied inline

  var css = `
    #hotels-container {
      grid-template-areas: ${gridTemplateAreasSmallerScreensString};
    }

    @media screen and (min-width: 992px) {
      #hotels-container {
        grid-template-areas: ${gridTemplateAreasString};
      }
    }
  `;

  let style = document.getElementById('hotel-grid-styles');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('id', 'hotel-grid-styles');
    document.head.appendChild(style);
  }

  style.innerHTML = css;
}

function createGridTemplateAreasStringFromGridTemplateAreas(gridTemplateAreas) {
  var gridTemplateAreasString = '';

  for (var i = 0; i < gridTemplateAreas.length; ++i) {
    gridTemplateAreasString += `"${gridTemplateAreas[i].join(' ')}"`;

    if (i !== gridTemplateAreas.length - 1) {
      gridTemplateAreasString += '\n';
    }
  }

  return gridTemplateAreasString;
}

function createGridTemplateColumnsString(columns) {
  var gridTemplateColumnsString = '';

  for (var i = 0; i < columns; ++i) {
    gridTemplateColumnsString += '1fr ';
  }

  return gridTemplateColumnsString.trim();
}

function createHotelCard(hotel, index) {
  var hotelCard = document.createElement('div');

  hotelCard.addEventListener('mouseover', function (event) {
    // highlight appropriate marker on map
    hotelMapMarkers[`hotel-${index}`].setIcon(highlightedMapMarker);
  });

  hotelCard.addEventListener('mouseout', function (event) {
    // remove highlight from appropriate marker on map
    hotelMapMarkers[`hotel-${index}`].setIcon(defaultMapMarker);
  });

  hotelCard.addEventListener('click', function (event) {
    showHotelModal(hotel, index);
  });

  hotelCard.id = `hotel-${index}`;
  hotelCard.classList.add('hotel-card');
  hotelCard.style.gridArea = `hotel-${index}`;

  var hotelCardImageHolder = document.createElement('div');
  hotelCardImageHolder.classList.add('hotel-card-image-holder');
  if (hotel.propertyImage && hotel.propertyImage.image && hotel.propertyImage.image.url) {
    hotelCardImageHolder.style.backgroundImage = `url(${hotel.propertyImage.image.url})`;
  } else {
    // put a placeholder image in its place
  }

  var hotelCardBody = document.createElement('div');
  hotelCardBody.classList.add('hotel-card-body', 'text-truncate');

  var hotelCardTop = document.createElement('div');
  hotelCardTop.classList.add('hotel-card-top');

  var hotelCardBottom = document.createElement('div');
  hotelCardBottom.classList.add('hotel-card-bottom');

  var hotelCardBottomLeft = document.createElement('div');
  hotelCardBottomLeft.classList.add('hotel-card-bottom-left');

  var hotelCardBottomMiddle = document.createElement('div');
  hotelCardBottomMiddle.classList.add('hotel-card-bottom-middle');

  var hotelCardBottomRight = document.createElement('div');
  hotelCardBottomRight.classList.add('hotel-card-bottom-right');

  var hotelCardlName = document.createElement('div');
  hotelCardlName.classList.add('hotel-card-name', 'text-truncate');
  hotelCardlName.textContent = hotel.name;

  var hotelCardLocation = document.createElement('div');
  hotelCardLocation.classList.add('hotel-card-location');

  if (hotel.neighborhood) {
    hotelCardLocation.textContent = hotel.neighborhood.name;
  }

  var hotelCardRating = document.createElement('div');
  hotelCardRating.classList.add('hotel-card-rating');

  var hotelCardRatingNumber = document.createElement('div');
  hotelCardRatingNumber.classList.add('hotel-card-rating-number');
  if (hotel.reviews && hotel.reviews.score) {
    if (hotel.reviews.score === 0) {
      hotelCardRatingNumber.textContent = '-';
    } else {
      hotelCardRatingNumber.textContent = hotel.reviews.score.toFixed(1);
    }
  }

  var hotelCardRatingOutOfText = document.createElement('div');
  hotelCardRatingOutOfText.classList.add('hotel-card-rating-out-of-text');
  hotelCardRatingOutOfText.textContent = '/';

  var hotelCardRatingOutOfNumber = document.createElement('div');
  hotelCardRatingOutOfNumber.classList.add('hotel-card-rating-out-of-number');
  hotelCardRatingOutOfNumber.textContent = '10';

  var hotelCardReviewsNumber = document.createElement('div');
  hotelCardReviewsNumber.classList.add('hotel-card-reviews-number');
  hotelCardReviewsNumber.textContent = `${hotel.reviews.total} Reviews`;

  var hotelCardPrice = document.createElement('div');
  hotelCardPrice.classList.add('hotel-card-price');

  var hotelCardPriceAmount = document.createElement('div');
  hotelCardPriceAmount.classList.add('hotel-card-price-amount');
  if (hotel.price && hotel.price.lead && hotel.price.lead.amount) {
    hotelCardPriceAmount.textContent = hotel.price.lead.amount.toFixed(2);
  }

  var hotelCardPriceCurrency = document.createElement('div');
  hotelCardPriceCurrency.classList.add('hotel-card-price-currency');
  hotelCardPrice.textContent = hotel.price.lead.currencyInfo.symbol;

  var hotelCardPriceUnit = document.createElement('div');
  hotelCardPriceUnit.classList.add('hotel-card-price-unit');
  if (hotel.price && hotel.price.priceMessages && hotel.price.priceMessages[0]) {
    hotelCardPriceUnit.textContent = hotel.price.priceMessages[0].value;
  }

  hotelCard.appendChild(hotelCardImageHolder);
  hotelCard.appendChild(hotelCardBody);

  hotelCardBody.appendChild(hotelCardTop);
  hotelCardBody.appendChild(hotelCardBottom);

  hotelCardTop.appendChild(hotelCardlName);
  hotelCardTop.appendChild(hotelCardLocation);

  hotelCardBottom.append(hotelCardBottomLeft);
  hotelCardBottom.append(hotelCardBottomMiddle);
  hotelCardBottom.append(hotelCardBottomRight);

  hotelCardBottomLeft.appendChild(hotelCardPrice);
  hotelCardBottomLeft.appendChild(hotelCardPriceUnit);

  hotelCardBottomRight.appendChild(hotelCardRating);
  hotelCardBottomRight.appendChild(hotelCardReviewsNumber);

  hotelCardRating.appendChild(hotelCardRatingNumber);
  hotelCardRating.appendChild(hotelCardRatingOutOfText);
  hotelCardRating.appendChild(hotelCardRatingOutOfNumber);

  hotelCardPrice.appendChild(hotelCardPriceCurrency);
  hotelCardPrice.appendChild(hotelCardPriceAmount);

  return hotelCard;
}

async function showHotelModal(hotel) {
  var modalMapContainer = document.getElementById('modal-map-container');
  var recommendationsContainer = document.getElementById('modal-recommendations');
  emptyElement(modalMapContainer);
  emptyElement(recommendationsContainer);

  var { latitude, longitude } = hotel.mapMarker.latLong;
  var hotelCoordinates = { latitude, longitude };

  var modal = document.getElementById('modal');
  var bsModal = new bootstrap.Modal(document.getElementById('modal'));

  var modalTitle = document.getElementById('modal-title');
  modalTitle.textContent = hotel.name;

  var carouselInner = document.getElementById('carousel-inner');
  emptyElement(carouselInner);

  var mainImageValid = false;
  if (hotel.propertyImage && hotel.propertyImage.image && hotel.propertyImage.image.url) {
    createCarouselItem(hotel.propertyImage.image.url, carouselInner, true);
    mainImageValid = true;
  }

  if (hotel.propertyImage && hotel.propertyImage.fallbackImage && hotel.propertyImage.fallbackImage.url) {
    createCarouselItem(hotel.propertyImage.fallbackImage.url, carouselInner, !mainImageValid);
  }

  var modalPrice = document.getElementById('modal-price');
  if (hotel.price && hotel.price.lead && hotel.price.lead.amount) {
    var price = hotel.price.lead.amount.toFixed(2);
    modalPrice.innerHTML = `<div>$${price}</div><small>per night</small>`;
  }

  var modalRating = document.getElementById('modal-rating');
  var rating;
  if (hotel.reviews && hotel.reviews.score) {
    if (hotel.reviews.score === 0) {
      rating = '-';
    } else {
      rating = hotel.reviews.score.toFixed(1);
    }
    modalRating.innerHTML = `<div>${rating}</div><small>RATING</small>`;
  }

  var modalReviews = document.getElementById('modal-reviews');
  var reviews;
  if (hotel.reviews && hotel.reviews.total) {
    if (hotel.reviews.total === 0) {
      reviews = '-';
    } else {
      reviews = hotel.reviews.total
    }
    modalReviews.innerHTML = `<div>${reviews}</div><div>REVIEWS</div>`;
  }

  bsModal.show();

  var modalMapElement = document.createElement('div');
  modalMapElement.classList.add('prominent-section');
  modalMapElement.id = 'modal-map';
  modalMapContainer.appendChild(modalMapElement);

  var recommendations = await getRecommendationsNearLocation({ latitude, longitude });

  showModalMap(hotel.name, { lat: latitude, lng: longitude }, recommendations);

  renderRecommendationsToModal(recommendations, recommendationsContainer);
}

function renderRecommendationsToModal(recommendations, appendTo) {
  emptyElement(appendTo);

  var titleContainer = document.createElement('div');
  titleContainer.classList.add('col-12', 'mb-4');
  titleContainer.innerHTML = '<h2>Here are some points of interest near the hotel</h2>';
  appendTo.appendChild(titleContainer);

  for (var [category, details] of Object.entries(recommendations)) {
    var categoryContainer = document.createElement('div');
    categoryContainer.classList.add('col-12', 'col-lg-6', 'mb-4');
    appendTo.appendChild(categoryContainer);

    var categoryHeading = document.createElement('h3');
    categoryHeading.classList.add('fs-4', 'text-center');
    categoryHeading.textContent = details.title;
    categoryContainer.appendChild(categoryHeading);

    var categoryListGroup = document.createElement('ul');
    categoryListGroup.classList.add('list-group');
    categoryContainer.appendChild(categoryListGroup);

    for (var loc of details.locations) {
      var categoryLocationListItem = document.createElement('div');
      categoryLocationListItem.classList.add('list-group-item', 'flex-fill');
      categoryLocationListItem.innerHTML = `${loc.name} <span class="modal-location-distance badge bg-secondary">${loc.dist.toFixed(0)}m</span>`;

      categoryListGroup.appendChild(categoryLocationListItem);
    }
  }
}

function createCarouselItem(src, appendTo, active = false, captionHead = '', captionBody = '', alt = '') {
  var carouselItem = document.createElement('div');
  carouselItem.classList.add('carousel-item');
  carouselItem.setAttribute('data-bs-interval', '10000');

  if (active) {
    carouselItem.classList.add('active');
  }

  carouselItem.innerHTML = `<img src="${src}" class="d-block w-100 h-100 object-fit-cover" alt="${alt}">`;
  // carouselItem.innerHTML += `<div class="carousel-caption d-none d-md-block">
  //   <h5>${captionHead}</h5>
  //   <p>${captionBody}</p>
  // </div>`

  appendTo.appendChild(carouselItem);
}

function highlightHotelCard(hotelId) {
  var hotelCard = document.getElementById(hotelId);

  if (hotelCard === null) {
    return;
  }

  hotelCard.classList.add('highlighted-hotel-card');
}

function unhighlightHotelCard(hotelId) {
  var hotelCard = document.getElementById(hotelId);

  if (hotelCard === null) {
    return;
  }

  hotelCard.classList.remove('highlighted-hotel-card');
}

function createHotelContainerHeader(regionName, weatherWidgets, regionImage) {
  var hotelHeader = document.createElement('h3');
  hotelHeader.classList.add('m-0');
  hotelHeader.textContent = "Hotels in " + regionName;

  hotelSearchLocationElement.appendChild(hotelHeader);

  for (widget of weatherWidgets) {
    hotelsWidgetsContainer.appendChild(widget);
  }

  console.log(regionImage)

  if (regionImage !== undefined) {
    hotelsHeaderImage.style.backgroundImage = `url(${regionImage.src})`;
    hotelsHeaderWrapper.style.backgroundImage = `url(${regionImage.src})`;
  }
}

function createMapContainer() {
  mapContainer = document.createElement('div');
  mapContainer.setAttribute('id', 'map-container');
  // mapContainer.classList.add('d-none');
  mapContainer.style.gridArea = 'map';

  var mapElement = document.createElement('div');
  mapElement.setAttribute('id', 'map');
  mapContainer.appendChild(mapElement);

  mapElement.classList.add('map');

  return mapContainer;
}

function putPageIntoLoadingState() {
  showElement(loadingSpinnerContainer);
  hideElement(hotelSearchIcon);
  // hideElement(hotelsHeaderContainer);
  // hideElement(hotelsBodyContainer);
  // hideElement(mapContainer);

  makeFaint(hotelsToolbarContainer);
  makeFaint(hotelsHeaderContainer);
  makeFaint(hotelsBodyContainer);
  hotelSearchButton.disabled = true;

  loading = true;
}

function takePageOutOfLoadingState(success = true) {
  hideElement(loadingSpinnerContainer);
  showElement(hotelSearchIcon);
  hotelSearchButton.disabled = false;
  makeNotFaint(hotelsToolbarContainer)
  makeNotFaint(hotelsHeaderContainer);
  makeNotFaint(hotelsBodyContainer);
  loading = false;

  if (!success) {
    return;
  }
  
  showSearchResults();
  clearSearchBar();
  dockJumbotron();
}

function showSearchResults() {
  showElement(hotelsToolbarContainer);
  showElement(hotelsHeaderContainer);
  showElement(hotelsBodyContainer);

  // showElement(mapContainer);
}

function hideSearchResults() {
  hideElement(hotelsToolbarContainer);
  hideElement(hotelsHeaderContainer);
  hideElement(hotelsBodyContainer);
}


function makeFaint(element) {
  if (element === undefined || element === null) {
    return;
  }

  element.style.opacity = 0.3;
}

function makeNotFaint(element) {
  if (element === undefined || element === null) {
    return;
  }

  element.style.opacity = null;
}

function hideElement(element) {
  if (element === undefined) {
    return;
  }

  element.classList.add('d-none');
}

function showElement(element) {
  if (element === undefined) {
    return;
  }

  element.classList.remove('d-none');
}

function emptyElement(element) {
  if (element === undefined || element === null) {
    return;
  }

  element.innerHTML = '';
}

function emptyHotelContainers() {
  // emptyElement(hotelsHeaderContainer);
  emptyElement(hotelsBodyContainer);
  emptyElement(hotelSearchLocationElement);
  emptyElement(hotelsWidgetsContainer);
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

function clearSearchBar() {
  hotelSearchBox.value = '';
}

function dockJumbotron() {
  if (jumbotronDocked) {
    return;
  }

  jumbotronDocked = true;

  jumbotron.classList.add('docked-jumbotron');
  hotelSearchForm.classList.add('docked-hotel-search-form');

  hotelSearchForm.classList.remove('col-md-8');
}

function undockJumbotron() {
  jumbotronDocked = false;

  jumbotron.classList.remove('docked-jumbotron');
  hotelSearchForm.classList.remove('docked-hotel-search-form');

  hotelSearchForm.classList.add('col-md-8');
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

async function simulateNetworkCall() {
  return new Promise(resolve => setTimeout(resolve, getRandomInt(500, 2000)));
}

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

$(hotelSearchForm).on('submit', function (event) {
  event.preventDefault();
  searchLocationForHotels({searchType: 'search'});
});

$(".dropdown-item").on("click", function (event) {
  event.preventDefault();

  // Update sortOrder when an item is clicked
  sortOrder = $(this).data("index");

  searchLocationForHotels({ sortOrder, searchType: 'filter' });
});

window.addEventListener('load', function () {
  hotelSearchBox.focus();
  // searchLocationForHotels({}, 'London');
});

/* Maps functionality Start */

var mapMarkers = [];

var defaultMapMarker = L.ExtraMarkers.icon({
  shape: 'circle',
  markerColor: 'blue',
  prefix: 'fa',
  icon: '',
  iconColor: '#fff',
  iconRotate: 0,
  extraClasses: '',
  number: '',
  svg: false,
});

var highlightedMapMarker = L.ExtraMarkers.icon({
  shape: 'star',
  markerColor: 'yellow',
  prefix: 'fa',
  icon: '',
  iconColor: '#fff',
  iconRotate: 270,
  extraClasses: '',
  number: '',
  svg: false,
});

function updateMapWithRenderedHotels(hotels, numberOfHotelsToDisplay) {
  var slicedHotels = hotels.slice(0, numberOfHotelsToDisplay);

  resetMap(map);
  createMapMarkersForHotels(slicedHotels);
  addMarkersToMap();
  fitMapToMarkers();
}

function createMapMarkersForHotels(hotels) {
  mapMarkers = [];
  hotelMapMarkers = {};

  for (var i = 0; i < hotels.length; ++i) {
    createMapMarker(hotels[i], i);
  }
}

function unhighlightAll() {
  mapMarkers.forEach(marker => marker.setIcon(defaultMapMarker));
  document.querySelectorAll('.hotel-card').forEach(hotelCard => hotelCard.classList.remove('highlighted-hotel-card'));
}

function createMapMarker(hotel, i) {
  var { latitude, longitude } = hotel.mapMarker.latLong;
  var latLng = [latitude, longitude];

  var marker = L.marker(latLng, { title: hotel.name, icon: defaultMapMarker });

  marker.once('mouseover', function (event) {
    unhighlightAll()

    this.setIcon(highlightedMapMarker);
    highlightHotelCard(`hotel-${i}`);
  });

  marker.on('mouseout', function (event) {
    this.setIcon(defaultMapMarker);
    unhighlightHotelCard(`hotel-${i}`);
    unhighlightAll();

    this.once('mouseover', function (event) {
      unhighlightAll();

      this.setIcon(highlightedMapMarker);
      highlightHotelCard(`hotel-${i}`);
    })
  });

  mapMarkers.push(marker);
  hotelMapMarkers[`hotel-${i}`] = marker;

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

/* Weather functionality Start */

var weatherApiKey = '60138034af71780e3420402cea540efb';

var geoApiURLPrefix = 'https://api.openweathermap.org/geo/1.0/direct?';
var currentWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/weather?';
var forecastWeatherApiURLPrefix = 'https://api.openweathermap.org/data/2.5/forecast?';
var weatherApiImagePrefix = 'https://openweathermap.org/img/wn/';

var localStorageCoordinates = [];
var weatherApiError = ''; // non empty string when an api error occurs - globally scoped because it is accessed in numerous closures

async function getCurrentWeatherData(coordinates) {
  // instantiate current weather data return object
  var currentWeatherData = {};

  // construct url using user provided latitude and longitude
  var url = currentWeatherApiURLPrefix + `lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${weatherApiKey}`;

  var response = await fetch(url);

  if (!response.ok) {
    updateApiError('An API Error occurred. Please try again later.');
  }

  var weatherData = await response.json();
  console.log(weatherData);

  currentWeatherData.location = coordinates.name;
  currentWeatherData.temperature = convertTemperatureInKtoC(weatherData.main.temp).toFixed(0); // API returns weather in Kelvin so we convert to Celsius using a helper function before returning
  currentWeatherData.wind = convertMpsToKph(weatherData.wind.speed).toFixed(2); // API returns m/s so we convert to kph first
  currentWeatherData.humidity = weatherData.main.humidity;
  currentWeatherData.weatherIcons = weatherData.weather.map(condition => condition.icon);

  return currentWeatherData;
}

function convertTemperatureInKtoC(temperature) {
  return temperature - 273.15;
}

function convertMpsToKph(mps) {
  // convert meters per second to kilometers per hour

  return mps * 3.6;
}

function updateWeatherApiError(newError) {
  if (weatherApiError === '') {
    weatherApiError = newError;
  }
}

async function createWeatherWidgets(coordinates) {
  var weatherWidgets = [];

  try {
    var weatherData = await getCurrentWeatherData(coordinates);
  } catch (error) {
    console.log(error);

    return weatherWidgets;
  }

  var temperatureWidget = document.createElement('div');
  var weatherIconWidget = document.createElement('div');

  temperatureWidget.classList.add('hotel-widget', 'hotel-widget-temperature', 'subtle-shadow');
  weatherIconWidget.classList.add('hotel-widget', 'hotel-widget-weather-icon', 'subtle-shadow');

  var temperatureWidgetTemperature = document.createElement('div');
  var temperatureWidgetDegreesCelsius = document.createElement('div');

  temperatureWidget.appendChild(temperatureWidgetTemperature);
  temperatureWidget.appendChild(temperatureWidgetDegreesCelsius);

  temperatureWidgetTemperature.classList.add('hotel-widget-temperature-temperature', 'fs-1', 'fw-bold');

  temperatureWidgetDegreesCelsius.classList.add('hotel-widget-temperature-degrees-c');

  if (weatherData.temperature.toString().length === 1) {
    temperatureWidgetDegreesCelsius.classList.add('single-digit-temperature');
  };

  temperatureWidgetTemperature.textContent = `${weatherData.temperature}`;
  temperatureWidgetDegreesCelsius.textContent = '°c';

  weatherWidgets.push(temperatureWidget);

  if (weatherData.weatherIcons && weatherData.weatherIcons.length > 0) {
    weatherIconWidget.style.backgroundImage = `url(${weatherApiImagePrefix}${weatherData.weatherIcons[0]}@2x.png)`;

    weatherWidgets.push(weatherIconWidget);
  }

  return weatherWidgets;
}

/* Weather functionality End */

/* Images API */

async function getImagesBasedOnString(string) {
  string = string.trim().toLowerCase();

  var imageFromLocalStorage = getImagesBasedOnStringFromLocalStorage(string);

  var choosePexels = new Set();
  // choosePexels.add('London');

  if (imageFromLocalStorage !== undefined) {
    return getRandomElementFromArray(imageFromLocalStorage);
  }

  var images;
  var triedUnsplash = false;

  if (!choosePexels.has(string)) {
    images = await getImageBasedOnStringUnsplash(string);
    triedUnsplash = true;
  }

  if (images === undefined) {
    images = await getImagesBasedOnStringPexels(string);
  }

  if (!triedUnsplash) {
    images = await getImageBasedOnStringUnsplash(string);
  }

  if (images === undefined) {
    return undefined;
  }

  addImageSearchToLocalStorage(string, images);

  return getRandomElementFromArray(images);
}

var pexelsApiKey = 'dtrWFUVjWibbygEarHZzUstSDs1kDpr5NdXVVFP1aXcXT0Vu1u5vF7es';
var pexelsApiBaseURL = 'https://api.pexels.com/v1';

async function getImagesBasedOnStringPexels(string) {
  console.log(`Searching API for images matching: "${string}"`);

  var url = `${pexelsApiBaseURL}/search?query=${string}&orientation=square`;
  var corsUrl = `${corsProxyURLPrefix}${encodeURIComponent(url)}`;

  var pexelsApiOptions = {
    method: 'GET',
    headers: {
      'Authorization': pexelsApiKey,
    }
  }

  var response = await fetch(corsUrl, pexelsApiOptions);
  var decodedResponse = await response.json();

  if (decodedResponse.total_results === 0) {
    return undefined;
  }

  var images = decodedResponse.photos.map(photo => ({ src: photo.src.large2x, avgColor: photo.avg_color }));

  return images;
}

function getImagesBasedOnStringFromLocalStorage(string) {
  var images = imagesSearchData[string];

  if (!images || images.length === 0) {
    return undefined;
  }

  console.log(`Image for search string: "${string}" retrieved from local storage.`)

  // var image = getRandomElementFromArray(images);

  return images;
}

function addImageSearchToLocalStorage(string, images) {
  if (imagesSearchData[string] === undefined) {
    imagesSearchData[string] = [];
  }

  for (image of images) {
    imagesSearchData[string].push(image);
  }

  saveDataToLocalStorage(saveOptions.images);

  console.log(`Saved images for string: "${string}" to local storage.`)
}

var unsplashApiKey = 'aZ2nCNIqgQZVKUSEASmMdkmy4FZ8xm05LvD9Qi5x8KY';
var unsplashApiBaseURL = 'https://api.unsplash.com';
var unsplashApiVersion = 'v1';

var unsplashApiOptions = {
  method: 'GET',
  headers: {
    'Authorization': `Client-ID ${unsplashApiKey}`,
    'Accept-Version': unsplashApiVersion,
  }
}

async function getImageBasedOnStringUnsplash(string) {
  var url = `${unsplashApiBaseURL}/search/photos?query=${string}`;
  var corsUrl = `${corsProxyURLPrefix}${encodeURIComponent(url)}`;

  try {
    var response = await fetch(corsUrl, unsplashApiOptions);
    var data = await response.json();

    if (data.results.length === 0) {
      return undefined;
    }

    var imageId = data.results[0].id;

    url = `${unsplashApiBaseURL}/photos/${imageId}`;
    corsUrl = `${corsProxyURLPrefix}${encodeURIComponent(url)}`;

    var response2 = await fetch(corsUrl, unsplashApiOptions);
    var data2 = await response2.json();

    if (!data2.id) {
      return undefined;
    }

    return [{ src: data2.urls.raw, avgColor: data2.color, blurHash: data2.blur_hash }];
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

/* Images API End */

function getRandomElementFromArray(array) {
  // placeholder just return the 0th element

  return array[0];
}

function colorWeatherWidgetsByBackgroundColor(weatherWidgets, avgColor) {
  var contrastColor;

  return;

  try {
    contrastColor = getTextColor(avgColor);
  } catch (error) {
    contrastColor = 'black';
  }

  for (weatherWidget of weatherWidgets) {
    weatherWidget.classList.add(`hotel-widget-${contrastColor}`);
    weatherWidget.style.color = avgColor;
  }
}

/** START: https://wunnle.com/dynamic-text-color-based-on-background  **/

function getRGB(c) {
  return parseInt(c, 16) || c
}

function getsRGB(c) {
  return getRGB(c) / 255 <= 0.03928
    ? getRGB(c) / 255 / 12.92
    : Math.pow((getRGB(c) / 255 + 0.055) / 1.055, 2.4)
}

function getLuminance(hexColor) {
  return (
    0.2126 * getsRGB(hexColor.substr(1, 2)) +
    0.7152 * getsRGB(hexColor.substr(3, 2)) +
    0.0722 * getsRGB(hexColor.substr(-2))
  )
}

function getContrast(f, b) {
  const L1 = getLuminance(f)
  const L2 = getLuminance(b)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

function getTextColor(bgColor) {
  const whiteContrast = getContrast(bgColor, '#ffffff')
  const blackContrast = getContrast(bgColor, '#000000')

  return whiteContrast > blackContrast ? 'white' : 'black'
}

/** END: https://wunnle.com/dynamic-text-color-based-on-background  **/

/** Local suggestions API Start */

//--> static inputs for /{lang}/places/radius endpoint 
const suggestionsRadius = "10000";
const suggestionsListLimit = "2";
const suggestionsMinPopularity = "1";
const suggestionsOpenTripApiKey = "5ae2e3f221c38a28845f05b600eb874f334b70babd7547a89821c944";

//--> Function to call API for a given category

function getRecommendationsNearLocationFromLocalStorage(coordinates) {
  var coordinatesAsString = convertCoordinatesToLatLonString(coordinates);
  var recommendations = recommendationsData[coordinatesAsString];

  return recommendations;
}

function addRecommendationsToLocalStorage(coordinates, recommendations) {
  var coordinatesAsString = convertCoordinatesToLatLonString(coordinates);

  recommendationsData[coordinatesAsString] = recommendations;
  saveDataToLocalStorage(saveOptions.recommendations);
}

function convertCoordinatesToLatLonString(coordinates) {
  return `${coordinates.latitude},${coordinates.longitude}`;
}

async function getRecommendationsNearLocation(coordinates) {
  var localStorageRecommendations = getRecommendationsNearLocationFromLocalStorage(coordinates);

  if (localStorageRecommendations !== undefined) {
    console.log(`Retrieved recommendations near coordinates (lat: ${coordinates.latitude}, lon: ${coordinates.longitude}) from local storage.`);
    return localStorageRecommendations;
  }

  const cafeRest = {
    title: 'Restaurants🍴😋',
    searchKeywords: "cafes,restaurants",

  };
  const barPub = {
    title: 'Bars and Pubs 🍸🍻',
    searchKeywords: "bars,pubs"
  };
  const entertainment = {
    title: 'Entertainment 🎉🎭',
    searchKeywords: "amusements,sport,casino,theatres_and_entertainments"
  }
  const culture = {
    title: 'Culture 🖼️🏛️',
    searchKeywords: "museums,historic_architecture,towers,historical_places,monuments_and_memorials"
  }

  var categories = { cafeRest, barPub, entertainment, culture };
  var recommendations = await getRecommendationsForCategories(categories, coordinates);

  addRecommendationsToLocalStorage(coordinates, recommendations);

  return recommendations;
}

async function getRecommendationsForCategories(categories, coordinates) {
  var recommendationsAsArray = await Promise.all(Object.entries(categories).map(async ([category, categoryDetails]) => {
    return {
      category,
      title: categoryDetails.title,
      locations: await getRecommendationsForActivitiesByLocation(categoryDetails.searchKeywords, coordinates),
    }
  }));

  var recommendations = {};

  for (recommendation of recommendationsAsArray) {
    var category = recommendation.category;
    var title = recommendation.title;
    var locations = recommendation.locations;

    recommendations[category] = { locations, title };
  }

  return recommendations;
}

async function getRecommendationsForActivitiesByLocation(activities, coordinates) {
  // activities is a comma separated string

  var queryURL = `https://api.opentripmap.com/0.1/en/places/radius?radius=${suggestionsRadius}&lon=${coordinates.longitude}&lat=${coordinates.latitude}&kinds=${activities}&rate=${suggestionsMinPopularity}&format=json&limit=${suggestionsListLimit}&apikey=${suggestionsOpenTripApiKey}`;

  var response = await fetch(queryURL);
  var data = await response.json();

  return data;
}

/** Local suggestions API End */

async function showModalMap(hotelName, hotelLocation, recommendations, useGoogle = true) {
  if (useGoogle) {
    showGoogleMap(hotelName, hotelLocation, recommendations);
  } else {
    showLeafletMap();
  }
}

function showLeafletMap() {
  modalMap = L.map('modal-map').setView([51.05, -0.09], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(modalMap);

  modal.addListenerOnce('shown.bs.modal', () => {
    modalMap.invalidateSize();
  });
}

/** Modal map Google Maps Start */
async function showGoogleMap(hotelName, hotelLocation, recommendations) {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary(
    "marker",
  );
  var modalGoogleMap = new Map(document.getElementById("modal-map"), {
    zoom: 16,
    center: hotelLocation,
    mapId: "4504f8b37365c3d0",
  });

  google.maps.event.addListenerOnce(modalGoogleMap, 'tilesloaded', function () {
    console.log('google map loaded');
  })

  //-->Creates a hotel marker and makes it bigger than default
  const hotelMarker = new PinElement({
    scale: 1.3,
  });

  //--> Creates an info window to share between markers.
  infoWindow = new InfoWindow();

  const markerViewScaled = new AdvancedMarkerElement({
    map: modalGoogleMap,
    position: hotelLocation,
    content: hotelMarker.element,
    title: hotelName
  });

  markerViewScaled.addListener('click', createClickListener(hotelName, markerViewScaled));

  //--> for loop iterates through categories arrays and creates a marker with a designated custom design
  for ([category, recommendation] of Object.entries(recommendations)) {
    var imgSrc;

    switch (category) {
      case 'cafeRest':
        imgSrc = "./assets/images/restaurant_googleMaps_Icon.png";
        break;
      case 'barPub':
        imgSrc = "./assets/images/Bar_GoogleMaps_Icon.png";
        break;
      case 'entertainment':
        imgSrc = "./assets/images/entertainment_GoogleMaps_Icon.png";
        break;
      case 'culture':
        imgSrc = "./assets/images/culture_GoogleMaps_Icon.png";
        break;
    }

    for (loc of recommendation.locations) {
      var img = document.createElement("img");
      img.src = imgSrc
      var locationImgView = new AdvancedMarkerElement({
        map: modalGoogleMap,
        position: { lat: loc.point.lat, lng: loc.point.lon },
        content: img,
        title: loc.name
      });

      console.log(loc)

      locationImgView.addListener('click', createClickListener(loc.name, locationImgView));
    }
  }
}

function createClickListener(title, markerView) {
  return ({ domEvent, latLng }) => {
    const { target } = domEvent;

    infoWindow.close();
    infoWindow.setContent(title);
    infoWindow.open(markerView.map, markerView);
  };
}
/** Modal map Google Maps End */

/* Navbar Function  */

document.getElementById('homeLink').addEventListener('click', function() {
  clearSearchResults();

});

function clearSearchResults() {
  currentSearchLocation = undefined;
  hideSearchResults();
  undockJumbotron();
}

/* Navbar Function  */