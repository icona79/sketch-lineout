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
var linesColorShapePath = "#FF54ED";
var linesColorText = "#3DB7E9";
var linesColorShape = "#F748A5";

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
        layoutArtboard.background = {
            enabled: true,
            includedInExport: true,
            color: "#ffffffff",
        };

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

    // **************************************
    // Script functions
    // **************************************
    let isShape = false;
    function outlineLayers(layer, parentLayer = layer, isShape = false) {
        resetStyle(layer);
        layer.sharedStyle = "";

        let parent = parentLayer;

        layer.layers.forEach((layer) => {
            if (layer.type === "Group" || layer.type === "SymbolInstance") {
                if (layer.type === "SymbolInstance") {
                    layer = layer.detach({
                        recursively: true,
                    });
                }
                isShape = isShapeLayer(layer, isShape);
                layer.sharedStyle = "";
                resetStyle(layer);
                layer.flow = undefined;

                if (layer.layers.length > 0) {
                    layer.layers.forEach((groupLayer) => {
                        if (
                            groupLayer.type === "Group" ||
                            groupLayer.type === "SymbolInstance"
                        ) {
                            if (groupLayer.type === "SymbolInstance") {
                                groupLayer = groupLayer.detach({
                                    recursively: true,
                                });
                            }
                            groupLayer.sharedStyle = "";
                            resetStyle(groupLayer);
                            groupLayer.flow = undefined;
                            outlineLayers(groupLayer, groupLayer, isShape);
                        } else {
                            outline(groupLayer, layer, isShape);
                        }
                    });

                    if (identifier.includes("label") && isShape) {
                        let newDescription = newLabel(
                            layer,
                            parent,
                            linesColorShapePath
                        );
                        newDescription.frame.y -= newDescription.frame.height;
                    }
                }
            } else {
                outline(layer, parent, isShape);
            }
        });
    }

    function outline(layer, parentLayer, isShape) {
        if (layer.type === "HotSpot") {
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
            newReactangle.style.fills = [];
            if (identifier.includes("label")) {
                let newDescription = newLabel(
                    layer,
                    parentLayer,
                    linesColorText
                );
                newDescription.frame.y = labelPosition(newDescription);
            }
            newReactangle.parent = parentLayer;
            layer.remove();
        } else if (layer.type === "ShapePath") {
            layer.sharedStyle = "";
            layer.style.fills = [];
            layer.style.borders = [
                {
                    color: linesColorShapePath,
                    fillType: Style.FillType.Color,
                    position: Style.BorderPosition.Center,
                },
            ];
            if (identifier.includes("label") && !isShape) {
                let newDescription = newLabel(
                    layer,
                    parentLayer,
                    linesColorShapePath
                );

                newDescription.frame.y = labelPosition(newDescription);
            }
        } else if (layer.type === "Shape" && identifier.includes("shapes")) {
            layer.sharedStyle = "";
            layer.style.fills = [];
            layer.style.borders = [
                {
                    color: linesColorShapePath,
                    fillType: Style.FillType.Color,
                    position: Style.BorderPosition.Center,
                },
            ];
            if (identifier.includes("label") && !isShape) {
                let newDescription = newLabel(
                    layer,
                    parentLayer,
                    linesColorShapePath
                );

                newDescription.frame.y = labelPosition(newDescription);
            }
        } else if (layer.type === "Shape" && !identifier.includes("shapes")) {
            layer.sharedStyle = "";
            layer.style.fills = [];
            let newX = layer.frame.x;
            let newY = layer.frame.y;

            let newReactangle = createShapePath(
                parentLayer,
                newX,
                newY,
                layer.frame.width,
                layer.frame.height,
                "#ffffff00",
                linesColorShape,
                layer.name
            );
            newReactangle.parent = parentLayer;
            newReactangle.style.fills = [];

            if (identifier.includes("label") && !isShape) {
                let newDescription = newLabel(
                    layer,
                    parentLayer,
                    linesColorShapePath
                );

                newDescription.frame.y = labelPosition(newDescription);
            } else if (identifier.includes("label") && !isShape) {
                let newDescription = newLabel(
                    parentLayer,
                    parentLayer,
                    linesColorShapePath
                );

                newDescription.frame.y = labelPosition(newDescription);
            }
            layer.remove();
        }
    }

    function isShapeLayer(layer, isShape) {
        let layers = layer.layers;
        let layersType = [];

        layers.forEach((groupLayer) => {
            layersType.push(groupLayer.type);
        });

        let shapes = ["Shape", "ShapePath"];
        let groups = ["Group", "SymbolInstance"];

        if (containsOnly(layersType, shapes)) {
            isShape = true;
        } else if (
            layers.includes("Group") ||
            layers.includes("SymbolInstance")
        ) {
            const indexes = [];
            for (let index = 0; index < layers.length; index++) {
                if (
                    layers[index] === "Group" ||
                    layers[index] === "SymbolInstance"
                ) {
                    indexes.push(index);
                }
            }
            for (let i = 0; i < indexes.length; i++) {
                if (layer.layers[indexes[i]].type === "SymbolInstance") {
                    let temporaryGroup = layer.layers[indexes[i]].duplicate();
                    layer = temporaryGroup.detach({
                        recursively: true,
                    });
                }
                isShapeLayer(layer.layers[indexes[i]], isShape);
            }
        } else {
            isShape = false;
        }

        return isShape;
    }
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

function newLabel(layer, parent = layer, color) {
    let Text = sketch.Text;
    let newText = new Text({
        parent: parent,
        text: layer.name,
        frame: {
            x: layer.frame.x,
            y: layer.frame.y,
            width: 100,
            height: 21,
        },
        style: { textColor: color, alignment: "left", borders: [], fills: [] },
        name: "Label - " + layer.name,
    });

    newText.adjustToFit();
    resetStyle(newText);
    return newText;
}

function labelPosition(item, isGroup = false) {
    let defaultY = item.frame.y;
    let parentHeight = 0;
    let artboard = item.getParentArtboard();
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

function containsOnly(array1, array2) {
    return array2.every((elem) => array1.includes(elem));
}

function resetStyle(layer) {
    layer.style.fills = [];
    layer.style.borders = [];
    layer.style.shadows = [];
    layer.style.innerShadows = [];
    layer.style.blur = [];
}
