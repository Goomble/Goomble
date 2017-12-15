//reference: https://bl.ocks.org/sjengle/2f6d4832397e3cdd78d735774cb5a4f2

// the geojson files are large, so loading them locally
var urls = {
  basemap: "resources/district.geojson",
  treepoints: "resources/treepoints.csv",
};

var colorscale = d3.scaleOrdinal()
    .range(["#F7C480", "#97CFD0", "#00A2B3", "#F1788D", "#CF3E53", "#B9CA5D"]);

var svg = d3.select("body").select("svg");

var g = {
  basemap: svg.append("g").attr("id", "basemap"),
  treepoints: svg.append("g").attr("id", "treepoints"),
  tooltip: svg.append("g").attr("id", "tooltip"),
  details: svg.append("g").attr("id", "details"),
  legend: svg.append("g").attr("id","legend"),
  button: svg.append("g").attr("id","button")
};


// https://github.com/d3/d3-geo#conic-projections
var projection = d3.geoConicEqualArea();
var path = d3.geoPath().projection(projection);

// http://mynasadata.larc.nasa.gov/latitudelongitude-finder/
// center on san francisco [longitude, latitude]
// choose parallels on either side of center
projection.parallels([37.692514, 37.840699]);

// rotate to view we usually see of sf
projection.rotate([122, 0]);

// we want both basemap and streets to load before arrests
// https://github.com/d3/d3-queue
var q = d3.queue()
  .defer(d3.json, urls.basemap)
  .await(drawMap);

function drawMap(error, basemap) {
  if (error) throw error;
    
  // make sure basemap fits in projection
  projection.fitSize([960, 600], basemap);

  // draw basemap
  var land = g.basemap.selectAll("path.land")
    .data(basemap.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "land");

  g.basemap.selectAll("path.district")
    .data(basemap.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "district");

    
  // used to show neighborhood outlines on top of streets
  g.basemap.selectAll("path.neighborhood")
    .data(basemap.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "neighborhood")
    .each(function(d) {
      // save selection in data for interactivity
      d.properties.outline = this;
    });

//   setup tooltip (shows neighborhood name)
  var tip = g.tooltip.append("text").attr("id", "tooltip");
  tip.attr("text-anchor", "end");
  tip.attr("dx", -5);
  tip.attr("dy", -5);
  tip.style("visibility", "hidden");

  // add interactivity
  land.on("mouseover", function(d) {
      var on = d3.select(this).classed("on");
      var legendon = svg.selectAll("g").selectAll(".source").selectAll("text").classed("legendon");
      if (!on && !legendon) {
          tip.text(d.properties.supervisor);
          tip.style("visibility", "visible");
          d3.select(d.properties.outline).raise();
          d3.select(d.properties.outline).classed("active", true);
      }
    })
    .on("mousemove", function(d) {
      var on = d3.select(this).classed("on");
      if (!on) {
          var coords = d3.mouse(g.basemap.node());
          tip.attr("x", coords[0]);
          tip.attr("y", coords[1]);
      }
    })
    .on("mouseout", function(d) {
        var legendon = svg.selectAll("g").selectAll(".source").selectAll("text").classed("legendon");
        if (!legendon) {
            tip.style("visibility", "hidden");
            d3.select(d.properties.outline).classed("active", false);
        }
    });

    d3.csv(urls.treepoints, drawTreePoints);
}

function drawTreePoints(error, treepoints) {
  if (error) throw error;
  for (i = 0, sourcemap = []; i < treepoints.length; i++) {
      var sourcetmp = treepoints[i].Source;
      if (sourcemap.indexOf(sourcetmp) < 0) {
          sourcemap.push(sourcetmp);
      }
  }
  colorscale.domain(sourcemap);
  var symbols = g.treepoints.selectAll("circle")
    .data(treepoints)
    .enter()
    .append("circle")
    .attr("cx", function(d) {
      var points = d.Point.substring(1,d.Point.length-1).split(", ");
      return projection([+(points[1].repeat(1)), +(points[0].repeat(1))])[0];
    })
    .attr("cy", function(d) {
      var points = d.Point.substring(1,d.Point.length-1).split(", ");
      return projection([+(points[1].repeat(1)), +(points[0].repeat(1))])[1];
    })
    .attr("r", 2.5)
    .attr("class", "symbol")
    .style("fill", function(d) {return colorscale(d.Source);})
    .style("visibility","hidden");

  // add details widget
  // https://bl.ocks.org/mbostock/1424037
  var details = g.details.append("foreignObject")
    .attr("id", "details")
    .attr("width", 960)
    .attr("height", 600)
    .attr("x", 0)
    .attr("y", 0);

  var body = details.append("xhtml:body")
    .style("text-align", "left")
    .style("background", "none")
    .html("<p>N/A</p>");

  details.style("visibility", "hidden");

  symbols.on("mouseover", function(d) {
    d3.select(this).raise();
    d3.select(this).style("stroke", colorscale(d.Source))
        .style("stroke-width", "1.5px");
    body.html("<table border=0 cellspacing=0 cellpadding=2>" + "\n" +
      "<tr style=\"color:" + colorscale(d.Source) + "\"" + "><th>Source:</th><td>" + d.Source + "</td></tr>" + "\n" +
      "<tr><th>Address:</th><td>" + d.Address + "</td></tr>" + "\n" +
      "<tr><th>Neighborhood:</th><td>" + d.Neighborhood + "</td></tr>" + "\n" +
      "<tr><th>Category:</th><td>" + d.Category + "</td></tr>" + "\n" +
      "<tr><th>Status:</th><td>" + d.Status + "</td></tr>" +
      "</table>");

    details.style("visibility", "visible");
  });

  symbols.on("mouseout", function(d) {
    d3.select(this).style("stroke", "white").style("stroke-width", "1px");
    details.style("visibility", "hidden");
  });
    
  var land = g.basemap.selectAll("path.land");
    
    
  land.on("click", function(outer) {
    var me = d3.select(this);
    var on = me.classed("on");
    var legendon = svg.selectAll("g").selectAll(".source").selectAll("text").classed("legendon");
    if(!on && legendon === false) {
        var t = d3.transition();   
        symbols.filter(function(d) {
        return outer.properties.supervisor === d["Supervisor District"];
        })
        .transition()
        .style("fill-opacity","0.6")
        .on("end", function(d) {
            d3.select(this).style("visibility","visible");
            d3.select(outer.properties.outline).classed("active", false);
            d3.select("g#tooltip").select("text").style("visibility","hidden");
            me.classed("on", true);
        })
    }
    else if(on && legendon === false) {
        symbols.filter(function(d) {
        return outer.properties.supervisor === d["Supervisor District"];
        })
        .style("visibility", "hidden")
        .transition()
        .style("opacity", 1);
        d3.select(outer.properties.outline).classed("active", true);
        d3.select("g#tooltip").select("text").style("visibility","visible");
        me.classed("on", false);
        }
});
    
    g.legend.append("g")
    .attr("class", "header")
    .append("text")
    .attr("x", 940)
    .attr("y", 1)
    .attr("dy", "0.9em")
    .text("Source (Click to Filter): ");
    
    var legend = g.legend.selectAll("g.source")
    .data(colorscale.domain())
    .enter()
    .append("g")
    .attr("class", "source")
    .attr("transform", function(d, i) { return "translate(0," + (i+1) * 20 + ")"; })
    .style("fill", function(d) {return colorscale(d);});

    legend.append("rect")
     .attr("x", 940)
     .attr("width", 15)
     .attr("height", 15)

    legend.append("text")
    .attr("x", 935)
    .attr("y", 1)
    .attr("dy", "0.9em")
    .text(function(d) {return d; })
    .style("cursor","pointer");
    
    g.legend.append("g")
    .attr("class", "hideall")
    .append("text")
    .attr("x", 940)
    .attr("y", 150)
    .attr("dy", "0.9em")
    .text("Hide All");
    
    var legendtext = svg.selectAll("g").selectAll(".source").selectAll("text");
    var hideall = svg.select("g#legend").select(".hideall");
    
    legendtext.on("mouseover", function(outer) {
      var on = d3.select(this).classed("legendon");
      var landon = land.classed("on");
      if (!on && landon === false) {
            symbols.filter(function(d) {
                return outer === d.Source;
            })
            .style("fill-opacity", "2")
            .style("visibility", "visible");
      }
    })
    .on("mouseout", function(outer) {
        var on = d3.select(this).classed("legendon");
        var landon = land.classed("on");
        if (!on && landon === false) {
            symbols.filter(function(d) {
                return outer === d.Source;
            })
            .style("visibility", "hidden");
        }
    });
   
    
    legendtext.on("click", function(outer) {
    var me = d3.select(this);
    var on = me.classed("legendon");
    var landon = land.classed("on")
    if(!on && landon === false) {
        var t = d3.transition();   
        symbols.filter(function(d) {
        return outer === d.Source;
        })
        .transition(t)
        .style("fill-opacity","2")
        .on("end", function(d) {
            d3.select(this).style("visibility","visible");
        })
        me.classed("legendon",true);
    }
    else if(on && !landon) {
        symbols.filter(function(d) {
        return outer === d.Source;
        })
        .style("visibility", "hidden")
        .transition()
        .style("opacity", "1");
        me.classed("legendon",false);
        }
});
    
    hideall.on("click", function(outer) {
        var t = d3.transition();   
        symbols.transition(t)
        .style("fill-opacity", "0")
        .on("end", function(d) {
            d3.select(this).style("visibility", "hidden");
            land.classed("on", false);
            legendtext.classed("legendon", false)
        })
        
    })
       
}

function translate(x, y) {
  return "translate(" + String(x) + "," + String(y) + ")";
}
