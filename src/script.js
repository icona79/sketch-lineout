var sketch = require("sketch");
import { Page } from "sketch/dom";
var DataSupplier = require("sketch/data-supplier");
var document = sketch.getSelectedDocument();
var selectedItem = document.selectedLayers.layers[0];
var documentName = "data";
if (document.path) {
    documentName = normalizePaths(document.path.split("/").reverse()[0]);
    documentName = documentName.replace(".sketchcloud", "");
    documentName = documentName.replace(".sketch", "");
}

var { isNativeObject } = require("util");
const fs = require("@skpm/fs");
const os = require("os");
const path = require("path");
const desktopDir = path.join(os.homedir(), "Desktop");
const sketchDir = path.join(
    os.homedir(),
    "Library/Application Support/com.bohemiancoding.sketch3"
);

// Setup the folder structure to export our data
const imagesFolder = desktopDir + "/Images-" + normalizePaths(documentName);

createFolder(imagesFolder);

const exportOptions = {
    formats: "png",
    overwriting: true,
    output: imagesFolder,
};

export default function () {
    let data = {};
    let images = {};

    let layersShapes = sketch.find("ShapePath");
    let layersSymbolInstances = sketch.find("SymbolInstance");
    let layersSymbols = document.getSymbols();
    let layersImages = sketch.find("Image");

    layersShapes.forEach((layer) => {
        if (layer.style.fills.length > 0) {
            var imageFill = layer.style?.fills.reduce((prev, curr) => {
                if (curr.fillType !== "Pattern") return prev;
                return curr.pattern.image;
            }, null);
            if (imageFill) {
                var key = String(imageFill);
                let imageObj = {};
                imageObj["name"] = layer.name + "-" + key;
                imageObj["layer"] = imageFill;
                imageObj["parent"] = documentName;
                if (!images[key]) {
                    images[key] = imageObj;
                }
            }
        }
    });
    layersImages.forEach((layer) => {
        var key = String(layer.image.id);
        let imageObj = {};
        imageObj["name"] = normalizePaths(layer.name) + "-" + key;
        imageObj["layer"] = layer.image;
        imageObj["parent"] = documentName;
        if (!images[key]) {
            images[key] = imageObj;
        }
    });
    layersSymbols.forEach((layer) => {
        var overrides = layer.overrides.filter(function (o) {
            return (
                // o.editable &&
                ["symbolID", "stringValue", "image"].includes(o.property)
            );
        });
        var dataGroupByPath = { "": data };
        for (const o of overrides) {
            var pathComponents = o.path.split("/");
            pathComponents.pop();
            var parentPath = pathComponents.join("/");
            if (o.property == "symbolID") {
                dataGroupByPath[o.path] = {};
                if (dataGroupByPath[parentPath]) {
                    dataGroupByPath[parentPath][o.affectedLayer.name] =
                        dataGroupByPath[o.path];
                }
                continue;
            }
            if (o.property == "image") {
                var key = String(o.value.id);
                let imageObj = {};
                imageObj["name"] =
                    normalizePaths(o.affectedLayer.name) + "-" + key;
                imageObj["layer"] = o.value;
                imageObj["parent"] = documentName;
                if (!images[key]) {
                    images[key] = imageObj;
                }
            }
        }
    });

    layersSymbolInstances.forEach((layer) => {
        var overrides = layer.overrides.filter(function (o) {
            return (
                // o.editable &&
                ["symbolID", "stringValue", "image"].includes(o.property)
            );
        });
        var dataGroupByPath = { "": data };
        for (const o of overrides) {
            var pathComponents = o.path.split("/");
            pathComponents.pop();
            var parentPath = pathComponents.join("/");
            if (o.property == "symbolID") {
                dataGroupByPath[o.path] = {};
                if (dataGroupByPath[parentPath]) {
                    dataGroupByPath[parentPath][o.affectedLayer.name] =
                        dataGroupByPath[o.path];
                }
                continue;
            }
            if (o.property == "image") {
                var key = String(o.value.id);
                let imageObj = {};
                imageObj["name"] =
                    normalizePaths(o.affectedLayer.name) + "-" + key;
                imageObj["layer"] = o.value;
                imageObj["parent"] = documentName;
                if (!images[key]) {
                    images[key] = imageObj;
                }
            }
        }
    });

    var imagesData = Object.values(images);
    if (imagesData.length > 0) {
        const assetsPage = "Exportable Assets";
        var page = selectPage(findOrCreatePage(document, assetsPage));
        let posX = 0;
        let posY = 0;
        imagesData.forEach(function (image) {
            exportImageDataAsPng(
                image.layer,
                imagesFolder + "/" + String(image.name) + ".png"
            );
            var imgLayer = new sketch.Image({
                name: image.name,
                image: image.layer,
                frame: {
                    x: posX,
                    y: posY,
                    width: 100,
                    height: 100,
                },
                parent: document.selectedPage,
            });
            imgLayer.resizeToOriginalSize();
            console.log(imgLayer.exportFormats);
            imgLayer.exportFormats = [
                {
                    type: "ExportFormat",
                    fileFormat: "png",
                    suffix: "",
                    size: "1x",
                },
                {
                    type: "ExportFormat",
                    fileFormat: "png",
                    suffix: "@2x",
                    size: "2x",
                },
                {
                    type: "ExportFormat",
                    fileFormat: "png",
                    suffix: "@3x",
                    size: "3x",
                },
                {
                    type: "ExportFormat",
                    fileFormat: "svg",
                    suffix: "",
                    size: "1x",
                },
                {
                    type: "ExportFormat",
                    fileFormat: "pdf",
                    suffix: "",
                    size: "1x",
                },
            ];
            document.centerOnLayer(imgLayer);
        });
        organizeLayersInPage(document.selectedPage);
        const drawView = doc.contentDrawView();
        const curZoom = drawView.zoomValue();
        const curScroll = drawView.scrollOrigin();
        curScroll.x = 0;
        curScroll.y = 0;
        drawView.setScrollOrigin(curScroll);
    }

    sketch.UI.alert(
        "Images asset extraction complete",
        "You can find your image assets in your Desktop, in a folder named" +
            "Images-" +
            normalizePaths(documentName) +
            "\n\n" +
            "All the images are available into the page Exportable Assets"
    );
}

// **************************************
// Script functions
// **************************************
function createFolder(folder) {
    try {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }
    } catch (err) {
        console.error(err);
    }
}

function exportImageDataAsPng(imageData, path) {
    var rep = NSBitmapImageRep.imageRepWithData(imageData.nsdata);
    var png = rep.representationUsingType_properties(
        NSBitmapImageFileTypePNG,
        {}
    );
    png.writeToFile_atomically(path, "YES");
}

function exportImageDataAsJpg(imageData, path, quality) {
    var rep = NSBitmapImageRep.imageRepWithData(imageData.nsdata);
    var jpg = rep.representationUsingType_properties(
        NSBitmapImageFileTypeJPEG,
        { NSImageCompressionFactor: quality || 0.75 }
    );
    jpg.writeToFile_atomically(path, "YES");
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
