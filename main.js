require([
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/FeatureLayer",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/tasks/support/Query",
  "esri/tasks/QueryTask",
  "esri/widgets/ScaleBar",
  "esri/widgets/BasemapToggle"
], function(
  Map,
  MapView,
  FeatureLayer,
  Graphic,
  GraphicsLayer,
  SimpleMarkerSymbol,
  Query,
  QueryTask,
  ScaleBar,
  BasemapToggle
) {
// New map instance	
  var map = new Map({
    basemap: "dark-gray"
  });

// Instantiate MapView
  var view = new MapView({
    container: "viewDiv",
    map: map,
    zoom: 3,
    center: [0, 20]
  });

  var defaultCity = {
    type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
    outline: {
      // autocasts as new SimpleLineSymbol()
      color: "#71de6e",
      width: "0.5px"
    }
  };

  var colorVisVar = {
    type: "color",
    field: "POP",
    legendOptions: { title: "Population Per City By Color Ramp" },
    stops: [
      { value: 50000, color: "#f7fcfd" },
      { value: 100000, color: "#ccece6" },
      { value: 500000, color: "#66c2a4" },
      { value: 1000000, color: "#238b45" },
      { value: 5000000, color: "#006d2c" },
      { value: 10000001, color: "#00441b" }
    ]
  };

  var sizeVisVar = {
    type: "size",
    field: "POP",
    legendOptions: { title: "Population Per City By Point Size" },
    stops: [
      { value: 50000, size: 3, label: "< 50,000" },
      { value: 100000, size: 6, label: "50,000 - 100,000" },
      { value: 500000, size: 9, label: "250,000 - 500,000" },
      { value: 1000000, size: 12, label: "500,000 - 1,000,000" },
      { value: 5000000, size: 15, label: "1,000,000 - 5,000,000" },
      { value: 10000001, size: 20, label: "> 10,000,000" }
    ]
  };

  var cityRenderer = {
    type: "simple", // autocasts as new SimpleRenderer()
    symbol: defaultCity,
    // Set the color and size visual variables on the renderer
    visualVariables: [colorVisVar, sizeVisVar]
  };

  var cityTemplate = {
    title: "World Cities: {CITY_NAME}",
    content: "The population of {CITY_NAME} is {POP}.<br />",
    fieldInfos: [
      {
        fieldName: "POP",
        format: {
          digitSeparator: true,
          places: 0
        }
      },
      {
        fieldName: "CITY_NAME",
        format: {
          places: 0
        }
      }
    ]
  };

  var listNode = document.getElementById("list_cities");

  // Grab city feature layer from the server
  var cities = new FeatureLayer({
    url:
      "http://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0",
    visible: false,
    popupTemplate: cityTemplate
  });

  var defaultContinent = {
    type: "simple-fill", // autocasts as new SimpleFillSymbol()
    outline: {
      // autocasts as new SimpleLineSymbol()
      color: [53, 151, 143],
      width: "0.25px"
    }
  };

  var continentRenderer = {
    type: "simple", // autocasts as new SimpleRenderer()
    symbol: defaultContinent
  };
	
  // Grab continent feature layer from the server
  var continents = new FeatureLayer({
    url:
      "http://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/1",
    visible: true,
    renderer: continentRenderer,
    popupTemplate: {
      // autocasts as new PopupTemplate()
      title: "Continents of the World",
      content: "{CONTINENT} has a total of {SQMI} square miles.",
      fieldInfos: [
        {
          fieldName: "CONTINENT",
          format: {
            digitSeparator: true,
            places: 0
          }
        },
        {
          fieldName: "SQMI",
          format: {
            digitSeparator: true,
            places: 0
          }
        }
      ]
    }
  });

  // Add graphics layer to hold selected results
  var resultsLayer = new GraphicsLayer();

  // Add layers to map
  map.addMany([cities, continents, resultsLayer]);

  // add function to contain query codeblocks
  function continentSelect(event) {
    resultsLayer.removeAll();
    listNode.innerHTML = "Loading...";
    // var that stores the selected continent
    var continent = event.target.value;
    cities.definitionExpression = continent;

    // var that stores the continent query and selected dropdown value
    var continentWhere = "CONTINENT = '" + continent + "'";

    var continentQuery = new Query({
      where: continentWhere,
      returnGeometry: true,
      outFields: ["CONTINENT", "SQMI"]
    });

    continents.when(function() {
      cities.when(function() {
          return continents.queryFeatures(continentQuery);
        })
        .then(locateCities);
    });

    // Queries for the city layer
    function locateCities(chosenContinent) {
      var cityQuery = new Query({
        spatialRelationship: "intersects",
        returnGeometry: true,
        outFields: ["POP", "CITY_NAME"]
      });

      chosenContinent.features.forEach(function(cont) {
        cityQuery.geometry = cont.geometry;
        cities.queryFeatures(cityQuery).then(displayResults);
      });
    }

    cities.when(function() {
        return cities.queryExtent();
      })
      .then(function(response) {
        view.goTo(response.extent);
      });

    var graphics = [];

    function displayResults(results) {
      var fragment = document.createDocumentFragment();

      results.features.forEach(function(cityname, index) {
        cityname.symbol = new SimpleMarkerSymbol({
          style: "square",
          color: "yellowgreen",
          size: "6px"
        });

        graphics.push(cityname);

        var attributes = cityname.attributes;

        var name = attributes.CITY_NAME;

        // List cities from the queried layer
        var li = document.createElement("li");
        li.classList.add("panel-result");
        li.tabIndex = 0;
        li.setAttribute("data-result-id", index);
        li.textContent = name;

        fragment.appendChild(li);
      });

      listNode.innerHTML = "";
      listNode.appendChild(fragment);
      resultsLayer.addMany(graphics);
	  view.goTo(graphics);
    }

    // Listen for clicks on panel city list
    listNode.addEventListener("click", onListClickHandler);

    // On click instructions
    function onListClickHandler(event) {
      var target = event.target;
      var resultId = target.getAttribute("data-result-id");

      var result = resultId && graphics && graphics[parseInt(resultId, 10)];

      if (result) {
        view.goTo(result);
        view.popup.open({
          features: [result],
          location: result.geometry.centroid
        });
      }
    }
  }

  document
    .getElementById("Selection")
    .addEventListener("change", continentSelect);

  // Add basemap options
  var toggle = new BasemapToggle({
    view: view,
    nextBasemap: "satellite"
  });

  view.ui.add(toggle, "bottom-left");

  // Add scalebar
  var scaleBar = new ScaleBar({
    view: view,
    unit: "dual"
  });

  view.ui.add(scaleBar, {
    position: "bottom-right"
  });
});
