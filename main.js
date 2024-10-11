/*
TODOs:
allow the user to switch stops from clicking on icons.
fix ordering of the stop selection
follow the bus when clicked
get distance to nearest bus
add changelog page
add github repo button
*/
const parser = new DOMParser();
let stopPredictionIntervalId;

async function populateBusLines() {
  const url =
    "https://retro.umoiq.com/service/publicXMLFeed?command=routeList&a=unitrans";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const result = await response.text();
    const busLinesXml = parser.parseFromString(result, "text/xml");

    const busLinesSelect = document.getElementById("lines");
    for (let i = 0; i < busLinesXml.getElementsByTagName("route").length; i++) {
      let option = document.createElement("option");
      option.text = busLinesXml
        .getElementsByTagName("route")
        [i].getAttribute("tag");
      option.value = option.text;
      busLinesSelect.appendChild(option);
    }

    // Fix weird firefox selection bug
    busLinesSelect.selectedIndex = 0;
    document.getElementById("stops").selectedIndex = 0;

    console.log("Completed Line search!");
  } catch (error) {
    throw new Error(`${error}`);
  }
}

async function populatePredictions(stopId, line) {
  // Wipe predictions on refresh.
  const etas = document.getElementById("etas");
  while (etas.childElementCount > 0) {
    etas.removeChild(etas.lastElementChild);
  }
  const url = `https://retro.umoiq.com/service/publicXMLFeed?command=predictions&a=unitrans&stopId=${stopId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const result = await response.text();
    const predictionsXml = parser.parseFromString(result, "text/xml");
    const etaDesc = document.getElementById("etaDesc");
    etaDesc.innerHTML = "A bus will arrive in...";
    etaDesc.removeAttribute("hidden");
    const etaDisc = document.getElementById("etaDisclaimer");
    etaDisc.removeAttribute("hidden");

    const predictionsCount =
      predictionsXml.getElementsByTagName("prediction").length; // NOTE: This variable does NOT provide an array of predictions, just how many.
    if (predictionsCount !== 0) {
      // Predictions available, not necessarily for this line.
      const predictions = predictionsXml.getElementsByTagName("predictions");
      // Actual "predictions" node, not "prediction"

      for (let i = 0; i < predictions.length; i++) {
        // we are now inside one "predictions"
        let direction = predictions[i].getElementsByTagName("direction");
        if (direction.length !== 0) {
          direction = direction[0].getAttribute("title");
        }
        const predictionList =
          predictions[i].getElementsByTagName("prediction");
        for (let j = 0; j < predictionList.length; j++) {
          let prediction = document.createElement("li");
          if (predictions[i].getAttribute("routeTag") == line) {
            prediction.innerHTML = `<font color="red"><b>${direction} on ${predictions[i].getAttribute("routeTag")}:
              ${predictionList[j].getAttribute("minutes")}
              minutes</b></font>`;
          } else {
            prediction.innerHTML = `${direction} on ${predictions[i].getAttribute("routeTag")}:
              ${predictionList[j].getAttribute("minutes")}
              minutes`;
          }

          /*
          if (predictions[i].getAttribute("routeTag") === line) {
            prediction.value = 1;
          }
          */
          etas.appendChild(prediction);
        }
      }
    } else {
      console.log("No predictions.");
      document.getElementById("etaDesc").innerHTML =
        "There are no buses available!";
    }
  } catch (error) {
    throw new Error(`${error}`);
  }
}

// Line selected
document.getElementById("lines").addEventListener("change", async function () {
  // upon line change, clear the stop selection and clear stops.
  // also reset map zoom
  const stops = document.getElementById("stops");
  while (stops.childElementCount > 1) {
    stops.removeChild(stops.lastElementChild);
  }
  stops.selectedIndex = 0;
  stops.firstElementChild.text = "Select a stop";
  map.setView([38.54593, -121.73615], 13);
  // upon line change, kill the predictor and flush list.
  if (stopPredictionIntervalId !== undefined) {
    clearInterval(stopPredictionIntervalId);
    const etas = document.getElementById("etas");
    while (etas.childElementCount > 0) {
      etas.removeChild(etas.lastElementChild);
    }
    document.getElementById("etaDesc").setAttribute("hidden", "");
  }

  console.log(`Now displaying line: ${document.getElementById("lines").value}`);
  stopsLayer.clearLayers();
  const url = `https://retro.umoiq.com/service/publicXMLFeed?command=routeConfig&a=unitrans&r=${document.getElementById("lines").value}`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("${response.status}");
    }

    const result = await response.text();
    const busStopsXml = parser.parseFromString(result, "text/xml");

    const stopSelect = document.getElementById("stops");
    const stopSection = busStopsXml.getElementsByTagName("stop");
    for (let i = 0; i < stopSection.length; i++) {
      // generate stop markers for lines
      if (
        stopSection[i].getAttribute("title") !== null &&
        !stopSection[i].getAttribute("tag").includes("ar")
      ) {
        L.marker([
          stopSection[i].getAttribute("lat"),
          stopSection[i].getAttribute("lon"),
        ])
          .addTo(stopsLayer)
          .bindPopup(
            `<b>${stopSection[i].getAttribute("title")}<b>
            <br>Lat: ${stopSection[i].getAttribute("lat")}, Lon: ${stopSection[i].getAttribute("lon")}
            <br>Stop ID: ${stopSection[i].getAttribute("stopId")}`,
          );

        // set up stop marker selections
        let option = document.createElement("option");
        option.text = stopSection[i].getAttribute("title");
        option.value = stopSection[i].getAttribute("tag");
        option.setAttribute("data-lat", stopSection[i].getAttribute("lat"));
        option.setAttribute("data-lon", stopSection[i].getAttribute("lon"));
        option.setAttribute(
          "data-stopid",
          stopSection[i].getAttribute("stopId"),
        );
        stopSelect.appendChild(option);
      }
    }
  } catch (error) {
    throw new Error(`${error}`);
  }
});

// Stop selected
document.getElementById("stops").addEventListener("change", async function () {
  const currentStop =
    document.getElementById("stops")[
      document.getElementById("stops").selectedIndex
    ];
  console.log(`Now displaying stop: ${currentStop.value}`);

  map.setView(
    [
      currentStop.getAttribute("data-lat"),
      currentStop.getAttribute("data-lon"),
    ],
    20,
  );

  // call predictions
  if (stopPredictionIntervalId !== undefined) {
    console.log(`Stopping ${stopPredictionIntervalId}`);
    clearInterval(stopPredictionIntervalId);
  }
  populatePredictions(
    currentStop.getAttribute("data-stopid"),
    document.getElementById("lines").value,
  );
  stopPredictionIntervalId = setInterval(function () {
    populatePredictions(
      currentStop.getAttribute("data-stopid"),
      document.getElementById("lines").value,
    );
  }, 60000); // refresh every minute
});

async function updateBusPos() {
  busLayer.clearLayers();
  const url =
    "https://retro.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=unitrans&t=0";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const result = await response.text();

    const busPositionsXml = parser.parseFromString(result, "text/xml");
    const busPositions = busPositionsXml.getElementsByTagName("vehicle");

    for (let i = 0; i < busPositions.length; i++) {
      L.marker(
        [
          busPositions[i].getAttribute("lat"),
          busPositions[i].getAttribute("lon"),
        ],
        { icon: busIcon },
      )
        .addTo(busLayer)
        .bindPopup(
          `
              <b>ID: ${busPositions[i].getAttribute("id")}</b>
              <br>
              <b>Route: ${busPositions[i].getAttribute("routeTag")}</b>
              <br>
              <b>Data Age: ${busPositions[i].getAttribute("secsSinceReport")} sec</b>
              <br>
              <b>Speed: ${Math.round(busPositions[i].getAttribute("speedKmHr") / 1.609)} MPH</b>
              `,
        )
        .on("click", function () {
          map.setView([
            busPositions[i].getAttribute("lat"),
            busPositions[i].getAttribute("lon"),
          ]);
        });
    }
  } catch (error) {
    throw new Error(`${error}`);
  }
}

// Initialize the map and default view of Davis
const map = L.map("map").setView([38.54593, -121.73615], 13);
map.attributionControl.setPrefix(
  "<a href='https://leafletjs.com/'>Leaflet</a>",
);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
const stopsLayer = L.layerGroup().addTo(map);
const busLayer = L.layerGroup().addTo(map);
var busIcon = L.icon({
  iconUrl: "bus.png",
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, 0],
});

// Initialize the bus lines.
populateBusLines();
// Set up bus tracking
updateBusPos();
setInterval(updateBusPos, 10000);
