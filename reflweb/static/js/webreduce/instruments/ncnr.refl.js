// requires(webreduce.server_api)
webreduce = window.webreduce || {};
webreduce.instruments = webreduce.instruments || {};
webreduce.instruments['ncnr.refl'] = webreduce.instruments['ncnr.refl'] || {};

// define the loader and categorizers for ncnr.refl instrument
(function(instrument) {
  //function load_refl(datasource, path, mtime, db){
  function load_refl(load_params, db, noblock, return_type) {
    // load params is a list of: 
    // {datasource: "ncnr", path: "ncnrdata/cgd/...", mtime: 12319123109}
    var noblock = (noblock == true); // defaults to false if not specified
    var return_type = return_type || 'metadata';
    var calc_params = load_params.map(function(lp) {
      return {
        template: {
          "name": "loader_template",
          "description": "ReflData remote loader",
          "modules": [
            {"module": "ncnr.refl.ncnr_load", "version": "0.1", "config": {}}
          ],
          "wires": [],
          "instrument": "ncnr.magik",
          "version": "0.0"
        }, 
        config: {"0": {"filelist": [{"path": lp.path, "source": lp.source, "mtime": lp.mtime}]}},
        node: 0,
        terminal:  "output",
        return_type: return_type
      }
    });
    return webreduce.editor.calculate(calc_params, false, noblock).then(function(results) {
      results.forEach(function(result, i) {
        var lp = load_params[i];
        if (result && result.values) {
          result.values.forEach(function(v) {v.mtime = lp.mtime});
          if (db) { db[lp.path] = result; }
        }
      });
      return results;
    })
  }
  
  function make_range_icon(global_min_x, global_max_x, min_x, max_x) {
    var icon_width = 75;
    var rel_width = Math.abs((max_x - min_x) / (global_max_x - global_min_x));
    var width = icon_width * rel_width;
    var rel_x = Math.abs((min_x - global_min_x) / (global_max_x - global_min_x));
    var x = icon_width * rel_x;
      
    var output = "<svg class=\"range\" width=\"" + (icon_width + 2) + "\" height=\"12\">";
    output += "<rect width=\"" + width + "\" height=\"10\" x=\"" + x + "\" style=\"fill:IndianRed;stroke:none\"/>"
    output += "<rect width=\"" + icon_width + "\" height=\"10\" style=\"fill:none;stroke:black;stroke-width:1\"/>"
    output += "</svg>"
    return output
  }
  
  var primary_axis = {
    "specular": "Qz_target",
    "background+": "Qz_target",
    "background-": "Qz_target",
    "slit": "Qz_target",
    "intensity": "Qz_target", // what slit scans are called in refldata
    "rock qx": "Qx_target", // curve with fixed Qz
    "rock sample": "sample/angle_x", // Rocking curve with fixed detector angle
    "rock detector": "detector/angle_x" //Rocking curve with fixed sample angle
  }
  
  var get_refl_item = function(obj, path) {
    var result = obj,
        keylist = path.split("/");
    while (keylist.length > 0) {
      result = result[keylist.splice(0,1)];
    }
    return result;
  }
  
  function plot_refl_1d(refl_objs) {
    var series = [];
    var datas = [];
    refl_objs.forEach(function(entry) {
      var xdata = get_refl_item(entry, 'x');
      var xerr = get_refl_item(entry, 'dx');
      var ydata = get_refl_item(entry, 'v');
      var yerr = get_refl_item(entry, 'dv');
      var data = xdata.map(function(x, i) {
        let y = ydata[i];
        let dy = yerr[i];
        let dx = xerr[i]; 
        var point = [x, y, {
          "yupper": y+dy, "ylower": y-dy,
          "xupper": x+dx, "xlower": x-dx
        }];
        return point
      });
      
      datas.push(data);
      series.push({label: entry.name + ":" + entry.entry});

    });
    var xcol = 'x';
    var ycol = 'v';
    var data0 = refl_objs[0];
    var plottable = {
      type: "1d",      
      options: {
        series: series,
        axes: {
          xaxis: {label: data0.columns[xcol].label + "(" + data0.columns[xcol].units + ")"}, 
          yaxis: {label: data0.columns[ycol].label + "(" + data0.columns[ycol].units + ")"}},
        errorbar_width: 0,
      },
      data: datas
    }
    return plottable
  }
  function plot_refl_nd(refl_objs) {
    // entry_ids is list of {path: path, filename: filename, entryname: entryname} ids
    var series = new Array();
    var column_sets = refl_objs.map(function(ro) {
      let columns = ro.columns || {};
      var nscans = (ro.scan_value || []).length;
      var sv = ro.scan_value || [];
      var nscans = sv.length;
      return columns;
    });
    var datas = [], xcol;
    var ycol = "v";
    var xcol = "x";
    var all_columns = column_sets[0];
    column_sets.forEach(function(new_cols) {
      // match by label.
      var ncl = Object.keys(new_cols).map(function(nc) { return new_cols[nc].label })
      for (var c in all_columns) {
        var cl = all_columns[c].label;
        if (ncl.indexOf(cl) < 0) {
          delete all_columns[c];
        }
      }
    });
    
    refl_objs.forEach(function(entry) {
      var intent = entry['intent'];
      var colset = {}
      for (var col in all_columns) {
        if (all_columns.hasOwnProperty(col)) {
          var target = col;
          if (all_columns[col].is_scan) {
            var target_index = entry.scan_label.indexOf(col);
            target = 'scan_value/' + target_index;
          }
          colset[col] = {"values": get_refl_item(entry, target)};
          var errorbars_lookup = all_columns[col].errorbars;
          if (errorbars_lookup != null) {
            colset[col]["errorbars"] = get_refl_item(entry, errorbars_lookup);
          }
        }
      }
      var xydata = [], x, y;
      datas.push(colset);
      series.push({label: entry.name + ":" + entry.entry});

    });
    var plottable = {
      type: "nd",
      columns: all_columns,
      
      options: {
        series: series,
        axes: {
          xaxis: {label: all_columns[xcol].label + "(" + all_columns[xcol].units + ")"}, 
          yaxis: {label: all_columns[ycol].label + "(" + all_columns[ycol].units + ")"}},
        xcol: xcol, 
        ycol: ycol,
        errorbar_width: 0,
      },
      data: datas
    }

    return plottable
  } 
  
  instrument.plot = function(results) {
    var plottable;
    var params_expression = /(\.params|\.poldata|\.deadtime)$/;
    var by_datatype = {};
    results.forEach(function(r) { 
      if (r && r.datatype && r.values) {
        by_datatype[r.datatype] = by_datatype[r.datatype] || [];
        for (var iv=0; iv<r.values.length; iv++) {
          by_datatype[r.datatype].push(r.values[iv]);
        }
      }
    });
    var datatypes = Object.keys(by_datatype);
    //var datatypes = new Set();
    //results.forEach(function(r) { if (r.datatype != null) {datatypes.add(r.datatype)}});
    //if datatypes.size)
    //var uniform_type = results.every(function(r) { return })
    if (results == [null] || datatypes.length == 0 ) {
      return
    }
    else if (datatypes.length == 1 && ('ncnr.refl.refldata' in by_datatype) && by_datatype['ncnr.refl.refldata'].length > 0) {
      plottable = plot_refl_nd(by_datatype['ncnr.refl.refldata']);
    }
    else if (datatypes.length == 1 && ('ncnr.refl.footprint.params' in by_datatype) && by_datatype['ncnr.refl.footprint.params'].length > 0){
      var values = by_datatype['ncnr.refl.footprint.params'];
      var options = values[0].options;
      plottable = {
        "type": "1d_function", 
        "data": [], 
        "functions": values, 
        "options": options
      }
    }
    else if (
        datatypes.length == 2 && 
        ('ncnr.refl.refldata' in by_datatype) && 
        ('ncnr.refl.footprint.params' in by_datatype)) {
      plottable = plot_refl_1d(by_datatype['ncnr.refl.refldata']);
      plottable.functions = by_datatype['ncnr.refl.footprint.params'];
    }
    else if (result.datatype.match(params_expression)) {
      plottable = {"type": "params", "params": result.values}
    }
    return plottable;
  };
  instrument.load_file = load_refl; 
  instrument.default_categories = [
    [["sample", "name"]],
    [["intent"]], 
    [["filenumber"]], 
    [["polarization"]]
  ];
  instrument.categories = jQuery.extend(true, [], instrument.default_categories);
  
  function add_range_indicators(target, file_objs) {
    var propagate_up_levels = 2; // levels to push up xmin and xmax.
    var jstree = target.jstree(true);
    
    // first set min and max for entries:
    var to_decorate = jstree.get_json("#", {"flat": true})
      .filter(function(leaf) { 
        return (leaf.li_attr && 
                'filename' in leaf.li_attr && 
                leaf.li_attr.filename in file_objs &&
                'entryname' in leaf.li_attr && 
                'source' in leaf.li_attr &&
                'mtime' in leaf.li_attr) 
        })
    
    to_decorate.forEach(function(leaf, i) {
      var filename = leaf.li_attr.filename;
      var file_obj = file_objs[filename];
      var entry = file_obj.values.filter(function(f) {return f.entry == leaf.li_attr.entryname});
      if (entry && entry[0]) {
        var e = entry[0];
        var xaxis = 'x'; // primary_axis[e.intent || 'specular'];
        if (!(get_refl_item(entry[0], xaxis))) { console.log(entry[0]); throw "error: no such axis " + xaxis + " in entry for intent " + e.intent }
        var extent = d3.extent(get_refl_item(entry[0], xaxis));
        var leaf_actual = jstree._model.data[leaf.id];
        leaf_actual.li_attr.xmin = extent[0];
        leaf_actual.li_attr.xmax = extent[1];
        var parent = leaf;
        for (var i=0; i<propagate_up_levels; i++) {
          var parent_id = parent.parent;
          parent = jstree._model.data[parent_id];
          if (parent.li_attr.xmin != null) {
            parent.li_attr.xmin = Math.min(extent[0], parent.li_attr.xmin);
          }
          else {
            parent.li_attr.xmin = extent[0];
          }
          if (parent.li_attr.xmax != null) {
            parent.li_attr.xmax = Math.max(extent[1], parent.li_attr.xmax);
          }
          else {
            parent.li_attr.xmax = extent[1];
          }
        }
      }
    });

    // then go back through add range indicators
    for (fn in jstree._model.data) {
      leaf = jstree._model.data[fn];
      if (leaf.parent == null) {continue}
      var l = leaf.li_attr;
      var p = jstree._model.data[leaf.parent].li_attr;
      if (l.xmin != null && l.xmax != null && p.xmin != null && p.xmax != null) {
        var range_icon = make_range_icon(parseFloat(p.xmin), parseFloat(p.xmax), parseFloat(l.xmin), parseFloat(l.xmax));
        leaf.text += range_icon;
      }
    }
  }
  
  function add_sample_description(target, file_objs) {
    var jstree = target.jstree(true);
    var to_decorate = jstree.get_json("#", {"flat": true})
      .filter(function(leaf) { 
        return (leaf.li_attr && 
                'filename' in leaf.li_attr &&
                leaf.li_attr.filename in file_objs &&
                'entryname' in leaf.li_attr && 
                'source' in leaf.li_attr &&
                'mtime' in leaf.li_attr) 
        })
    to_decorate.forEach(function(leaf, i) {
      var values = file_objs[leaf.li_attr.filename].values || [];
      var entry = values.filter(function(f) {return f.entry == leaf.li_attr.entryname});
      if (entry && entry[0]) {
        var e = entry[0];
        if ('sample' in e && 'description' in e.sample) {
          var leaf_actual = jstree._model.data[leaf.id];
          leaf_actual.li_attr.title = e.sample.description;
          var parent_id = leaf.parent;
          var parent = jstree._model.data[parent_id];
          parent.li_attr.title = e.sample.description;
        }
      }
    });
  }
  
  function add_viewer_link(target, file_objs) {
    var jstree = target.jstree(true);
    var parents_decorated = {};
    var to_decorate = jstree.get_json("#", {"flat": true})
      .filter(function(leaf) { 
        return (leaf.li_attr && 
                'filename' in leaf.li_attr && 
                'source' in leaf.li_attr) 
        })
    // for refl, this will return a list of entries, but
    // we want to decorate the file that contains the entries.
    var viewer_link = {
      "ncnr": "https://ncnr.nist.gov/ipeek/nexus-zip-viewer.html",
      "ncnr_DOI": "https://ncnr.nist.gov/ipeek/nexus-zip-viewer.html",
      "charlotte": "https://charlotte.ncnr.nist.gov/ipeek/nexus-zip-viewer.html"
    }
    to_decorate.forEach(function(leaf, i) {
      var parent_id = leaf.parent;
      // only add link once per file
      if (parent_id in parents_decorated) { return }
      var fullpath = leaf.li_attr.filename;
      var datasource = leaf.li_attr.source;
      if (viewer_link[datasource]) {
        if (datasource == "ncnr_DOI") { fullpath = "ncnrdata" + fullpath; }
        var pathsegments = fullpath.split("/");
        var pathlist = pathsegments.slice(0, pathsegments.length-1).join("+");
        var filename = pathsegments.slice(-1);
        var link = "<a href=\"" + viewer_link[datasource];
        link += "?pathlist=" + pathlist;
        link += "&filename=" + filename;
        link += "\" style=\"text-decoration:none;\">&#9432;</a>";
        var parent_actual = jstree._model.data[parent_id];
        parent_actual.text += link;
        parents_decorated[parent_id] = true;
      }
    })
  }
  
  instrument.decorators = [add_range_indicators, add_sample_description, add_viewer_link];
  
  instrument.export_targets = [
    { 
      "id": "unpolarized_reflcalc",
      "label": "webfit",
      "type": "webapi",
      "url": "https://ncnr.nist.gov/instruments/magik/calculators/reflectivity-calculator.html",
      "method": "set_data"
    },
    { 
      "id": "polarized_reflcalc",
      "label": "pol. webfit",
      "type": "webapi",
      "url": "https://ncnr.nist.gov/instruments/magik/calculators/magnetic-reflectivity-calculator.html",
      "method": "set_data"
    }
  ]

  var NEXUZ_REGEXP = /\.nxz\.[^\.\/]+$/
  var NEXUS_REGEXP = /\.nxs\.[^\.\/]+(\.zip)?$/
  var BRUKER_REGEXP = /\.ra[ws]$/

  instrument.files_filter = function(x) {
    return (
      BRUKER_REGEXP.test(x) ||
      (NEXUZ_REGEXP.test(x) &&
         (/^(fp_)/.test(x) == false) &&
         (/^rapidscan/.test(x) == false) &&
         (/^scripted_findpeak/.test(x) == false))
    )
  }
    
})(webreduce.instruments['ncnr.refl']);

