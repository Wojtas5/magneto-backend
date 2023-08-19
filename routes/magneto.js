var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
const { Parser } = require('json2csv');
var lerp = require('lerp')

const MEASUREMENTS_FOLDER = 'measurements/';
const CALIBRATIONS_FOLDER = 'calibrations/';

let lastPosition = null;
let calibrationInProgress = false;

router.get('/calibration/size', function(req, res, next) {
    var files = fs.readdirSync(CALIBRATIONS_FOLDER);
    var calibration_files = files.filter(function(file) {
        return file.startsWith('calibration_');
    });

    if (calibration_files.length == 0) {
        res.status(200).send('0');
    } else if (calibrationInProgress) {
        res.status(102).send('0');
    } else {
        var latest_file = calibration_files.reduce(function(prev, curr) {
            var prevStats = fs.statSync(CALIBRATIONS_FOLDER + prev);
            var currStats = fs.statSync(CALIBRATIONS_FOLDER + curr);
            return prevStats.mtime > currStats.mtime ? prev : curr;
        });

        res.status(200).send(fs.statSync(CALIBRATIONS_FOLDER + latest_file).size.toString());
    }
});

router.get('/calibration', function(req, res, next) {
    var files = fs.readdirSync(CALIBRATIONS_FOLDER);
    var calibration_files = files.filter(function(file) {
        return file.startsWith('calibration_');
    });

    if (calibration_files.length == 0) {
        res.status(200).send('No calibration data available');
    } else {
        var latest_file = calibration_files.reduce(function(prev, curr) {
            var prevStats = fs.statSync(CALIBRATIONS_FOLDER + prev);
            var currStats = fs.statSync(CALIBRATIONS_FOLDER + curr);
            return prevStats.mtime > currStats.mtime ? prev : curr;
        });

        var file = fs.readFileSync(CALIBRATIONS_FOLDER + latest_file);
        res.status(200).send(file);
    }
});

router.get('/position', (req, res) => {
    if (lastPosition) {
        res.send(lastPosition);
    } else {
        res.status(404).send('No position data found.');
    }
});

router.get('/measurements/list', function(req, res, next) {
    var files = fs.readdirSync(MEASUREMENTS_FOLDER);
    var measurements_files = files.filter(function(file) {
        return file.startsWith('measurements_');
    });

    res.status(200).send(measurements_files);
});

router.get('/calibration/list', function(req, res, next) {
    var files = fs.readdirSync(CALIBRATIONS_FOLDER);
    var calibration_files = files.filter(function(file) {
        return file.startsWith('calibration_');
    });

    res.status(200).send(calibration_files);
});

router.get('/measurements/:filename', (req, res) => {
    const { filename } = req.params;
    const absolute_meas_path = "C:\\Users\\web_d\\Desktop\\repo\\magneto-backend\\measurements\\";
    const filePath = absolute_meas_path + filename;
  
    res.sendFile(filePath);
});

router.get('/calibrations/:filename', (req, res) => {
    const { filename } = req.params;
    const absolute_calib_path = "C:\\Users\\web_d\\Desktop\\repo\\magneto-backend\\calibrations\\";
    const filePath = absolute_calib_path + filename;

    res.sendFile(filePath);
});

router.use(bodyParser.text());

router.post('/position', (req, res) => {
    const position = req.body;
    lastPosition = position;

    res.status(200).send('Position saved successfully.');
});

router.post('/measurements', function(req, res, next) {
    calibrationInProgress = true;

    var date = new Date();
    var file_date = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate() + '-' + date.getHours() + '-' + date.getMinutes();
    var filename = MEASUREMENTS_FOLDER + 'measurements_' + file_date + '.csv';
    var calib_filename = CALIBRATIONS_FOLDER + 'calibration_' + file_date + '.csv';
    // var file = fs.createWriteStream(filename)
    //     .on('error', function(err) {
    //         console.log(err);
    //         res.status(500).send('Internal server error');
    //     })
    //     .on('close', function() {
    //         calibrate(filename);
    //     });

    // file.write('position,X1,Y1,Z1,X2,Y2,Z2,X3,Y3,Z3,X4,Y4,Z4,X5,Y5,Z5,X6,Y6,Z6,X7,Y7,Z7,X8,Y8,Z8,X9,Y9,Z9,X10,Y10,Z10,X11,Y11,Z11\n');
    // file.write(req.body);
    // file.end();

    fs.copyFile("fake/measurements_2023-4-19-23-35.csv", filename, (err) => {
        if (err) {
          console.log("Error Found:", err);
        }
    });
    fs.copyFile("fake/calibration_2023-4-19-23-35.csv", calib_filename, (err) => {
        if (err) {
          console.log("Error Found:", err);
        }
    });

    res.status(200).send('OK');
});

function calibrate(measurements_path) {
    var date = new Date();
    var file_date = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate() + '-' + date.getHours() + '-' + date.getMinutes();
    var calib_filename = CALIBRATIONS_FOLDER + 'calibration_' + file_date + '.csv';

    let df = csvToArray(measurements_path);
    dropColumnsFromArray(df, ['Y1', 'Z1', 'Y2', 'Z2', 'Y3', 'Z3', 'Y4', 'Z4', 'Y5', 'Z5', 'Y6', 'Z6', 
                              'Y7', 'Z7', 'Y8', 'Z8', 'Y9', 'Z9', 'Y10', 'Z10', 'Y11', 'Z11']);

    df = linearInterpolation(df);
    df = linearInterpolation(df);

    var calib_file = fs.createWriteStream(calib_filename)
        .on('error', function(err) {
            console.log(err);
        })
        .on('close', function() {
            calibrationInProgress = false;
        });

    calib_file.write(arrayToCSV(df));
    calib_file.end();
}

function csvToArray(csvFilePath) {
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    const dataArray = [];
  
    for (let i = 1; i < lines.length; i++) {

        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {

            const rowObject = {};
            for (let j = 0; j < headers.length; j++) {
                var rowValue = parseFloat(currentLine[j]);
                if (headers[j] === 'position') {
                    rowValue = +rowValue.toFixed(6);
                }

                rowObject[headers[j]] = rowValue;
            }
            dataArray.push(rowObject);
        }
    }
  
    return dataArray;
}

function arrayToCSV(dataArray) {
    const fields = Object.keys(dataArray[0]);
    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(dataArray);

    return csvData;
}

function dropColumnsFromArray(dataArray, columnsToDrop) {
    const modifiedArray = dataArray.map((row) => {
        columnsToDrop.forEach((column) => delete row[column]);
        return row;
    });
  
    return modifiedArray;
}

function linearInterpolation(dataArray) {
    for (let i = 0; i < dataArray.length - 1; i+=2) {
        const currentData = dataArray[i];
        const nextData = dataArray[i + 1];

        const interpolatedData = {};
        for (let key in currentData) {
            var interpolatedValue = lerp(currentData[key], nextData[key], 0.5);
            interpolatedValue = +interpolatedValue.toFixed(6);
            interpolatedData[key] = interpolatedValue;
        }

        dataArray.splice(i + 1, 0, interpolatedData);
    }

    return dataArray;
}

module.exports = router;
