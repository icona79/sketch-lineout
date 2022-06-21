var sketch = require("sketch");
var identifier = __command.identifier();
import { Page } from "sketch/dom";
var Style = require("sketch/dom").Style;
var Flow = require("sketch/dom").Flow;
var DataSupplier = require("sketch/data-supplier");
var doc = context.document;
var document = sketch.getSelectedDocument();
var selectedItem = document.selectedLayers.layers[0];
var documentName = "data";
if (document.path) {
    documentName = normalizePaths(document.path.split("/").reverse()[0]);
    documentName = documentName.replace(".sketchcloud", "");
    documentName = documentName.replace(".sketch", "");
}

var { isNativeObject } = require("util");

var lineoutPageName = "Lineouts";
var linesColor = "#FF54ED";
var linesColorText = "#3DB7E9";

export default function () {
    let selectedArtboard = document.selectedLayers.layers[0];
    if (
        document.selectedLayers.length == 1 &&
        (document.selectedLayers.layers[0].type === "Artboard" ||
            document.selectedLayers.layers[0].type === "SymbolMaster")
    ) {
        let lineoutPage = findOrCreatePage(document, lineoutPageName);
        let layoutArtboard = selectedArtboard.duplicate();
        layoutArtboard.parent = lineoutPage;

        if (layoutArtboard.type === "SymbolMaster") {
            layoutArtboard = layoutArtboard.toArtboard();
        }

        let outlines = outlineLayers(layoutArtboard, layoutArtboard);

        organizeLayersInPage(lineoutPage);
        selectPage(lineoutPage);
        layoutArtboard.selected = true;
        layoutArtboard.flowStartPoint = false;
        setTimeout(function () {}, 100);
        document.sketchObject.contentDrawView().centerLayersInCanvas();
        document.centerOnLayer(layoutArtboard);
    } else {
        sketch.UI.message("☝️ Please, select an Artboard");
    }
}

// **************************************
// Script functions
// **************************************

function outlineLayers(layer, parentLayer = layer) {
    let parent = parentLayer;
    layer.layers.forEach((layer) => {
        if (layer.type === "Group") {
            layer.style.fills = [];
            layer.flow = undefined;
            if (layer.layers.length > 0) {
                layer.layers.forEach((groupLayer) => {
                    if (groupLayer.type === "Group") {
                        groupLayer.style.fills = [];
                        groupLayer.flow = undefined;
                        outlineLayers(groupLayer, groupLayer);
                    } else {
                        outline(groupLayer, layer);
                    }
                });
            }
        } else {
            outline(layer, parent);
        }
    });
}

function outline(layer, parentLayer) {
    if (layer.type === "SymbolInstance") {
        let groupLayer = layer.detach({
            recursively: true,
        });
        outlineLayers(groupLayer, groupLayer);
    } else if (layer.type === "HotSpot") {
        layer.remove();
    } else if (layer.type === "Text") {
        let newX = layer.frame.x;
        let newY = layer.frame.y;
        let newReactangle = createShapePath(
            parentLayer,
            newX,
            newY,
            layer.frame.width,
            layer.frame.height,
            "#ffffff00",
            linesColorText,
            layer.name
        );
        newReactangle.parent = parentLayer;
        newReactangle.style.fills = [];
        let newDescription = createText(
            parentLayer,
            newX,
            newY,
            100,
            19,
            "Label - " + layer.name,
            layer.name,
            linesColorText
        );
        newDescription.frame.y = labelPosition(newDescription);
        layer.remove();
    } else if (layer.type === "ShapePath" || layer.type === "Shape") {
        layer.sharedStyle = "";
        layer.style.fills = [];
        layer.style.borders = [
            {
                color: linesColor,
                fillType: Style.FillType.Color,
                position: Style.BorderPosition.Center,
            },
        ];
        if (layer.type === "ShapePath") {
            let newDescription = createText(
                parentLayer,
                layer.frame.x,
                layer.frame.y,
                100,
                19,
                "Label - " + layer.name,
                layer.name,
                linesColor
            );
            newDescription.frame.y = labelPosition(newDescription);
        }
    }
}

function createArtboard(parentLayer, x, y, width, height, name) {
    let Artboard = sketch.Artboard;
    let artboard = new Artboard({
        name: name,
        parent: parentLayer,
        frame: {
            x: x,
            y: y,
            width: width,
            height: height,
        },
    });

    return artboard;
}

function createShapePath(
    parentLayer,
    x,
    y,
    width,
    height,
    background,
    border,
    name
) {
    let borders = [];
    if (border !== "") {
        borders = border;
    }
    let ShapePath = sketch.ShapePath;
    let newShape = new ShapePath({
        parent: parentLayer,
        frame: {
            x: x,
            y: y,
            width: width,
            height: height,
        },
        style: { fills: [background], borders: [borders] },
        name: name,
    });

    return newShape;
}

function createText(
    parentLayer,
    x = 0,
    y = 0,
    width = 100,
    height = 21,
    name,
    content,
    color
) {
    let Text = sketch.Text;
    let newText = new Text({
        parent: parentLayer,
        text: content,
        frame: {
            x: x,
            y: y,
            width: width,
            height: height,
        },
        style: { textColor: color, alignment: "left" },
        name: name,
    });
    newText.adjustToFit();
    return newText;
}

function labelPosition(item) {
    let defaultY = item.frame.y;
    let parentHeight = item.parent.frame.height;
    let artboard = item.getParentArtboard();
    // console.log(item.name);
    let newFrame = item.frame.changeBasis({
        from: item.parent,
        to: item.getParentArtboard(),
    });
    let newPosition = newFrame.y - item.frame.height;
    let newY = item.frame.y - item.frame.height;
    if (newPosition < 0) {
        newY = defaultY + parentHeight;
    }
    // console.log(newY);
    return newY;
}

function normalizePaths(path) {
    path = path.replace(/\s/g, "-");
    path = path.replace(/\_+/g, "-");
    path = path.replace(/\/+/g, "-");
    path = path.replace(/%20+/g, "-");
    path = path.replace(/\-+/g, "-").toLowerCase();

    return path;
}

function findOrCreatePage(document, name) {
    const [page] = document.pages.filter((page) => page.name === name);

    if (!page) {
        return new Page({
            name,
            parent: document,
        });
    } else {
        return page;
    }
}

function selectPage(page) {
    page.selected = true;
    return page;
}

function organizeLayersInPage(page) {
    if (page.layers.length > 0) {
        let x = 0;
        let y = 0;
        let maxY = 0;
        let counter = 0;
        page.layers.forEach((layer) => {
            if (counter % 10 == 0) {
                x = 0;
                y += maxY;
                maxY = 0;
            }
            layer.frame.x = x;
            layer.frame.y = y;
            x += layer.frame.width + 100;

            if (layer.frame.height > maxY - 100) {
                maxY = layer.frame.height + 100;
            }
            counter++;
        });
    }
}
