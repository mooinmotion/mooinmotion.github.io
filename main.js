async function populateBusLines() {
  const url =
    "https://retro.umoiq.com/service/publicXMLFeed?command=routeList&a=unitrans";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const result = await response.text();
    const parser = new DOMParser();
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

// Line selected
document.getElementById("lines").addEventListener("change", async function () {
  // upon line change, clear the stop selection and clear stops.
  const stops = document.getElementById("stops");
  while (stops.childNodes.length > 1) {
    stops.removeChild(stops.lastChild);
  }
  document.getElementById("stops").selectedIndex = 0;

  console.log(`Now displaying line: ${document.getElementById("lines").value}`);
  stopsLayer.clearLayers();
  const url = `https://retro.umoiq.com/service/publicXMLFeed?command=routeConfig&a=unitrans&r=${document.getElementById("lines").value}`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("${response.status}");
    }

    const result = await response.text();
    const parser = new DOMParser();
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
        stopSelect.appendChild(option);
      }
    }
    stopSelect[0].text = "Select a stop";
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
  console.log(currentStop.getAttribute("data-lon"));

  map.setView(
    [
      currentStop.getAttribute("data-lat"),
      currentStop.getAttribute("data-lon"),
    ],
    20,
  );
});

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

// Initialize the bus lines.
populateBusLines();
