'use strict';

const width = 960;
const height = 500;

const projection = d3.geoNaturalEarth1()
    .scale(150)
    .translate([width / 2, height / 2]);

const zoom = d3.zoom().on('zoom', zoomed);
const pathGenerator = d3.geoPath().projection(projection);

let svg = d3.select('#map-svg').append('svg')
    .attr('width', width)
    .attr('height', height);

svg.append('rect')
    .attr('style', 'fill: #F9F9F9')
    .attr('width', width)
    .attr('height', height);

let g = svg.append("g");

let country = document.getElementById('countryName');
let circuitName = document.getElementById('circuitName');
let latestWinner = document.getElementById('recentWinner');
let fastestLap = document.getElementById('fastestLap');

g.append('path')
    .attr('class', 'sphere')
    .attr('d', pathGenerator({type: 'Sphere'}));

svg.call(d3.zoom().on('zoom', () => {
    g.attr('transform', d3.event.transform);
}));

Promise.all([
    d3.csv('f1db_csv/circuits.csv'),
    d3.csv('f1db_csv/races.csv'),
    d3.csv('f1db_csv/results.csv'),
    d3.csv('f1db_csv/drivers.csv'),
    d3.tsv('https://unpkg.com/world-atlas@1.1.4/world/50m.tsv'), // used for country names
    d3.json('https://unpkg.com/world-atlas@1.1.4/world/50m.json') // world map paths
]).then(([circuitData, raceData, resultData, driverData, tsvData, topoJSONdata]) => {
    const countryName = {}; // { id: name }

    tsvData.forEach((d) => {
        countryName[d['iso_n3']] = d.name;
    });

    const countries = topojson.feature(topoJSONdata, topoJSONdata.objects['countries']); // returns geoJSON

    g.selectAll('path').data(countries.features)
        .enter().append('path')
        .attr('class', (d) => {
            const index = circuitData.findIndex(row => row.country === countryName[d.id])
            if (circuitData[index]) {
                return 'hasCircuit';
            } else return 'country'
        })
        .attr('d', pathGenerator)
        .on('click', (d) => {
            onClick(d);
        })

    function onClick(data) {
        // zoom to country
        let bounds = pathGenerator.bounds(data),
            dx = bounds[1][0] - bounds[0][0],
            dy = bounds[1][1] - bounds[0][1],
            x = (bounds[0][0] + bounds[1][0]) / 2,
            y = (bounds[0][1] + bounds[1][1]) / 2,
            scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
            translate = [width / 2 - scale * x, height / 2 - scale * y];

        svg.transition()
            .duration(750)
            .call( zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(scale) );

        // handle data
        country.innerHTML = countryName[data.id];
        circuitName.innerHTML = '';
        latestWinner.innerHTML = '';
        fastestLap.innerHTML = '';

        let circuits = [];
        circuitData.reduce((a, e) => {
            if (e.country === countryName[data.id]){
                circuits.push(e);
            }
        })

        if (circuits.length > 0) {
            let circuitNames = []
            let lastRaces = [];

            /* ----- retreive various data ----- */
            circuits.forEach((circuit, index) => {
                /* ----- circuit name ----- */
                let item = document.createElement('li');
                let name = document.createElement('p');
                name.innerHTML = circuit.name

                item.append(name);
                circuitNames.push(item);

               /* ------ most recent race per circuit ----- */
               var date = new Date();
               var Fullyear = date.getFullYear();
                raceData.forEach(race => {
                    if (race['circuitId'] === circuit['circuitId'] && race.year < Fullyear) {
                        if (lastRaces[index]) {
                            if (lastRaces[index].year < race.year) {
                                lastRaces[index] = race;
                            }
                        } else {
                            lastRaces[index] = race;
                        }
                    }
                });
            })

            /* ----- display circuit name(s) ----- */
            circuitNames.forEach(item => {
                circuitName.append(item);
            })

            lastRaces.forEach(race => {
                let result = resultData.find(row => row['raceId'] === race['raceId'])
                let driver = driverData.find(row => row['driverId'] === result['driverId'])

                /* ----- display last winner(s) ----- */
                let driverItem = document.createElement('li');
                let driverName = document.createElement('p');
                driverName.innerHTML = driver['forename'] + ' ' + driver['surname'] + ' (' + race['year'] + ')';

                driverItem.append(driverName);
                latestWinner.append(driverItem);

                /* ----- display fastest lap(s) ----- */
                let lapTimeItem = document.createElement('li');
                let lapTime = document.createElement('p');
                lapTime.innerHTML = result['fastestLapTime'];

                lapTimeItem.append(lapTime)
                fastestLap.append(lapTimeItem);
            })
        }
    }
});

function zoomed() {
    g.style('stroke-width', 1.5 / d3.event.transform.k + 'px'); // zoom: bounding box padding
    g.attr('transform', d3.event.transform);
}
