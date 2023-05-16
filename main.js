const vaccinationsUrl =
  "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations-by-manufacturer.csv";

const width = window.innerWidth;
const height = window.innerHeight * 0.9;
const margin = { left: 10, right: 10, top: 120, bottom: 80 };

const circleRadius = 15;
const maxCircleRadius = 50;
const minCircleRadius = 15;
const transitionDuration = 500;

const colors = [
  "gold",
  "blue",
  "yellow",
  "green",
  "maroon",
  "silver",
  "lime",
  "olive",
  "darkgreen",
  "pink",
  "brown",
  "slateblue",
  "orange",
  "teal",
  "cyan",
];

const spinnerOptions = {
  lines: 13, // The number of lines to draw
  length: 60, // The length of each line
  width: 17, // The line thickness
  radius: 80, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: "spinner-line-fade-quick", // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: "#ffffff", // CSS color or array of colors
  fadeColor: "transparent", // CSS color or array of colors
  top: "50%", // Top position relative to parent
  left: "50%", // Left position relative to parent
  shadow: "0 0 1px transparent", // Box-shadow for the lines
  zIndex: 2000000000, // The z-index (defaults to 2e9)
  className: "spinner", // The CSS class to assign to the spinner
  position: "absolute", // Element positioning
};

const findQuarter = (date) => {
  const quarter = d3.timeFormat("%q")(date);
  return `Q${quarter}`;
};

const drawChart = (location, data, svg, colorScale, binScale) => {
  const stackKeys = Array.from(new Set(data.map((d) => d["vaccine"])).values());

  stackKeys.forEach((d) => {
    const dataByVaccine = data
      .filter((k) => k["vaccine"] === d)
      .sort((a, b) => a.date - b.date)
      .map((t, i, arr) => {
        if (i === 0) {
          t.current_value = t["total_vaccinations"];
        } else {
          const diff =
            t["total_vaccinations"] - arr[i - 1]["total_vaccinations"];
          t.current_value = diff < 0 ? 0 : diff;
        }
        return t;
      });
  });

  const binnedData = d3
    .bin()
    .value((d) => d.date)
    .thresholds(binScale)(data);

  const years = Array.from(
    new Set(binnedData.map((d) => d3.timeFormat("%Y")(d.x0))).values()
  );

  const processedData = {
    name: location,
    children: [],
  };

  years.forEach((y) => {
    const obj1 = {
      name: y,
      children: [],
    };
    binnedData.forEach((d) => {
      if (d3.timeFormat("%Y")(d.x0) === y) {
        const obj2 = {
          name: findQuarter(d.x0),
          children: [],
        };
        stackKeys.forEach((vacc) => {
          const sum = d
            .filter((t) => t.vaccine === vacc)
            .reduce((acc, cv) => acc + cv.current_value, 0);
          if (sum > 0) {
            obj2.children.push({
              name: vacc,
              value: sum,
            });
          }
        });
        obj1.children.push(obj2);
      }
    });
    processedData.children.push(obj1);
  });

  const root = d3.hierarchy(processedData);

  root.descendants().forEach((d) => {
    d.id = `${d.data.name}-${Math.random()}`;
  });

  const circleScale = d3
    .scaleSqrt()
    .domain([0, d3.max(root.descendants(), (d) => d.data.value)])
    .range([minCircleRadius, maxCircleRadius]);

  const nodes = root.descendants();
  const links = root.links();

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(20)
        .strength(0.8)
    )
    .force("charge", d3.forceManyBody().strength(-400))
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => (d.children ? circleRadius : circleScale(d.data.value)))
        .iterations(4)
    );

  const tooltip = d3.select("#tooltip");

  const drag = (simulation) => {
    function dragstarted(e, d) {
      if (!e.active) {
        simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
      tooltip.style("visibility", "hidden");
    }

    function dragged(e, d) {
      d.fx = e.x;
      d.fy = e.y;
      tooltip.style("visibility", "hidden");
    }

    function dragended(e, d) {
      if (!e.active) {
        simulation.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null;
      tooltip.style("visibility", "hidden");
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  const chartGroup = svg
    .selectAll(".chart-group")
    .data([null])
    .join("g")
    .attr("class", "chart-group")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const gLink = chartGroup
    .selectAll(".g-link")
    .data([null])
    .join("g")
    .attr("class", "g-link")
    .attr("fill", "none")
    .attr("stroke", "#000")
    .attr("stroke-width", 1);

  const gNode = chartGroup
    .selectAll(".g-node")
    .data([null])
    .join("g")
    .attr("class", "g-node")
    .attr("pointer-events", "all");

  const mouseMoved = (e, d) => {
    if (!d.children) {
      const tooltipTitle = `<div>Vaccine: ${
        d.data.name
      }</div><div>Vaccinations: ${d3.format(",")(d.data.value)}`;

      tooltip
        .style("visibility", "visible")
        .style(
          "transform",
          `translate(calc(-50% + ${e.pageX}px), calc(-270% + ${e.pageY}px))`
        )
        .html(tooltipTitle);
    } else {
      tooltip.style("visibility", "hidden");
    }
  };

  const mouseLeft = (e, d) => {
    tooltip.style("visibility", "hidden");
  };

  const node = gNode
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("fill", (d) => (d.children ? "white" : colorScale(d.data.name)))
    .attr("stroke", (d) => (d.children ? "black" : "none"))
    .attr("r", (d) => (d.children ? circleRadius : circleScale(d.data.value)))
    .on("mouseenter mousemove", mouseMoved)
    .on("mouseleave", mouseLeft)
    .call(drag(simulation));

  const link = gLink.selectAll("line").data(links).join("line");

  const nodeTitle = gNode
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("class", "label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.32em")
    .attr("pointer-events", "none")
    .attr("paint-order", "stroke")
    .attr("stroke", "#fff")
    .attr("stroke-width", 3)
    .text((d) => d.data.name);

  const ticked = () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    nodeTitle.attr("x", (d) => d.x).attr("y", (d) => d.y);
  };

  simulation.on("tick", ticked);
};

const dataParse = (d) => {
  d.date = d3.timeParse("%Y-%m-%d")(d.date);
  d["total_vaccinations"] = +d["total_vaccinations"];
  return d;
};

const main = async () => {
  const spinnerTarget = document.getElementById("spinner");
  const spinner = new Spinner(spinnerOptions).spin(spinnerTarget);
  const vaccinationsData = await d3.csv(vaccinationsUrl, dataParse);
  spinner.stop();

  const locationList = [...new Set(vaccinationsData.map((d) => d.location))];

  const vaccines = Array.from(
    new Set(vaccinationsData.map((d) => d["vaccine"])).values()
  );
  const colorScale = d3.scaleOrdinal().domain(vaccines).range(colors);

  const binScale = d3
    .scaleTime()
    .domain(d3.extent(vaccinationsData, (d) => d.date))
    .ticks(d3.timeMonth.every(3));

  const svg = d3
    .select("#main-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(responsivefy);

  jSuites.dropdown(document.getElementById("location"), {
    data: locationList,
    value: "Japan",
    autocomplete: true,
    width: "280px",
    onload: () => {
      drawChart(
        "Japan",
        vaccinationsData.filter((t) => t.location === "Japan"),
        svg,
        colorScale,
        binScale
      );
    },
    onchange: (d) => {
      drawChart(
        d.value,
        vaccinationsData.filter((t) => t.location === d.value),
        svg,
        colorScale,
        binScale
      );
    },
  });
};

function responsivefy(svg) {
  const container = d3.select(svg.node().parentNode);
  const width = parseInt(svg.style("width"), 10);
  const height = parseInt(svg.style("height"), 10);
  const aspectRatio = width / height;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMid")
    .call(resize);

  d3.select(window).on("resize." + container.attr("id"), resize);

  function resize() {
    const targetWidth = parseInt(container.style("width"));
    svg.attr("width", targetWidth);
    svg.attr("height", Math.round(targetWidth / aspectRatio));
  }
}

main();
