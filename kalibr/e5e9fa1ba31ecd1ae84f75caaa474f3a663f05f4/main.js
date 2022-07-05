// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
let startButton = document.getElementById('startBtn');
let stopButton = document.getElementById('stopBtn');
let clearButton = document.getElementById('clrBtn');

let vibrospeedLabel = document.getElementById('vibrospeed');
let graphDiv = document.getElementById('div_v');
let graphLab = document.getElementById('labdiv');


var fftByteArray = new Uint16Array(4096);
var rawDataByteArray = new Int16Array(2*4096+10);

var devicename = 'data' ;

var coefficient_freq = 10000 ;

// при нажатии на кнопку START
startButton.addEventListener('click', function() {
  log('start');
  var uuid = $('#startBtn').attr('data-uuid');
  var value = 0x01 ; // $('#startBtn').attr('data-value');
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint16Array([value]);
  characteristic.writeValue(converted);
});

// при нажатии на кнопку STOP
stopButton.addEventListener('click', function() {
  log('stop');
  var uuid = $('#stopBtn').attr('data-uuid');
  var value = $('#stopBtn').attr('data-value');
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint16Array([value]);
  characteristic.writeValue(converted);
});

// при нажатии на кнопку CLEAR
clearButton.addEventListener('click', function() {
  log('clear');
  terminalContainer.innerHTML = "";
  for (let i=1;i<4096;i+=1) { fftByteArray[i] = 0 ; }
  for (let i=1;i<2*4096;i+=1) { rawDataByteArray[i] = 0 ; }
  datau = [] ;
});


// Записать значение в характеристику
function writeToCharacteristic(characteristic, data) {
  characteristic.writeValue(new TextEncoder().encode(data));
}

// Подключение к устройству при нажатии на кнопку Connect
connectButton.addEventListener('click', function() {
  connect();
});

// Отключение от устройства при нажатии на кнопку Disconnect
disconnectButton.addEventListener('click', function() {
  disconnect();
});

// Обработка события отправки формы
sendForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Предотвратить отправку формы
  send();
  log("send " + inputField.value, 'out');
  coefficient_freq = inputField.value ;
  // send(inputField.value); // Отправить содержимое текстового поля
//  inputField.value = '';  // Обнулить текстовое поле
  inputField.focus();     // Вернуть фокус на текстовое поле
});

// Кэш объекта выбранного устройства
let deviceCache = null;

let coefficientValueCharacteristic = null;
let fftCharacteristic = null;


// Запустить выбор Bluetooth устройства и подключиться к выбранному
function connect() {
  var _dev = (deviceCache ? Promise.resolve(deviceCache) : requestBluetoothDevice());
  _dev.then(device => showValues(device));
  return _dev
    .then(device => connectDeviceAndCacheCharacteristic(device))
    .then(characteristic => startNotifications(characteristic))
	.then(_ => {
    log('Readingcoefficient ...');
    return coefficientValueCharacteristic.readValue();
  })
    .catch(error => log(error));
}

// Запрос выбора Bluetooth устройства
function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
	  // acceptAllDevices: true,
    filters: [
	   // {services: [0xAA81]}
	   {namePrefix: 'AB4'}
	  ],
	  optionalServices: [0xAA80, 0xAA64]
  }).then(device => {
      log('"' + device.name + '" bluetooth device selected');
	  devicename = device.name ;
      deviceCache = device;

      // Добавленная строка
      deviceCache.addEventListener('gattserverdisconnected', handleDisconnection);

      return deviceCache;
    });
}

// Обработчик разъединения
function handleDisconnection(event) {
  let device = event.target;

  log('"' + device.name + '" bluetooth device disconnected, trying to reconnect...');

  connectDeviceAndCacheCharacteristic(device)
    .then(characteristic => startNotifications(characteristic))
    .catch(error => log(error));
}

// Кэш объекта характеристики
let characteristicCache = null;
let charArray = null;
// let ioCharacteristicCache = null;
let serviceInstance = null;

function getPrimaryService(device) {
  return serviceInstance
    ? Promise.resolve(serviceInstance)
    : device.gatt.connect()
      .then(server => {
        //log('GATT server connected, getting service...');
        serviceInstance = server ;
        return server.getPrimaryService(0xAA80);
      });
}

function readCharacteristic(device, param) {
  return getPrimaryService(device)
    .then(service => {
      return service.getCharacteristic(param);
    });
}

function showValues(device) {
  var chars = [0xAA81, 0xAA82, 0xAA84, 0xAA85];
  if (!charArray) {
    for (var i in chars) {
      readCharacteristic(device, chars[i])
        .then(characteristic => {
          if (!charArray) {
            charArray = {};
          }
          var uuid = characteristic.uuid;
          //if(uuid == '0000aa84-0000-1000-8000-00805f9b34fb') Promise.resolve(characteristic.readValue()) 
			Promise.resolve(0)
            .then(value => {
              var _val;
              var _dat;
              switch(uuid) {
                case '0000aa81-0000-1000-8000-00805f9b34fb':
                  _val = 0 ; // value.getUint32(0);
                  _dat = 'uint32';
                  break;
                case '0000aa82-0000-1000-8000-00805f9b34fb':
                  _val = 0 ; // value.getUint8(0);
                  $('#startBtn')
                    .attr('data-uuid', uuid)
                    .attr('data-value', 1);
                  $('#stopBtn')
                    .attr('data-uuid', uuid)
                    .attr('data-value', 0);
                  _dat = 'uint16';
                  break;
                case '0000aa84-0000-1000-8000-00805f9b34fb':
				  coefficientValueCharacteristic = characteristic;
				  coefficientValueCharacteristic.addEventListener('characteristicvaluechanged', handleCoefficientValueChanged);
				  
                  _val  = 0 ; // value.getInt16(0); ; // = 0 ; // = value.getInt16(0);
                  _dat = 'int16';
                  $('#input').attr('data-uuid', uuid);
                  $('#input').val(_val);
                  break;
              }
              charArray[uuid] = {
                characteristic: characteristic,
                value: _val,
                data: _dat
              };
			  log(uuid + ': ' + _val);
            });
        });
    }
  }
}

// Подключение к определенному устройству, получение сервиса и характеристики
function connectDeviceAndCacheCharacteristic(device) {
  if (device.gatt.connected && characteristicCache) {
    return Promise.resolve(characteristicCache);
  }

  log('Connecting to GATT server...');

  // return device.gatt.connect()
  //   .then(server => {
  //     log('GATT server connected, getting service...');
  //     serviceInstance = server ;
  //     return server.getPrimaryService(0xAA80);
  //   })
  return getPrimaryService(device)
    .then(service => {
      log('Service found, getting characteristic...');

      return service.getCharacteristic(0xAA81);
    })
    .then(characteristic => {
      log('Characteristic found');
      characteristicCache = characteristic;

      return characteristicCache;
    });
// 	   .then(_ => {
//         return serviceInstance.getPrimaryService(0xAA64);
// 		log('getting service...');
// 		then(newService => {
// 			log('Service found, getting characteristic...');
// 			return newService.getCharacteristic(0xAA65);
// 		})
// 		.then(newCharacteristic => {
// 			log('Characteristic found');
// 			ioCharacteristicCache = newCharacteristic;
// //			return ioCharacteristicCache;
// 		})
//       });
}

// Включение получения уведомлений об изменении характеристики
function startNotifications(characteristic) {
  log('Starting notifications...');

  return characteristic.startNotifications().
      then(() => {
        log('Notifications started');

        // Добавленная строка
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);	
      });
}

// Вывод в терминал
function log(data, type = '') {
  terminalContainer.insertAdjacentHTML('beforeEnd',
      '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
  //terminalContainer.scrollTop = terminalContainer.scrollHeight;
  //console.log(terminalContainer.scrollTop);
  //console.log(terminalContainer.scrollHeight);
}

// Отключиться от подключенного устройства
function disconnect() {
  if (deviceCache) {
    log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
    deviceCache.removeEventListener('gattserverdisconnected',
        handleDisconnection);

    if (deviceCache.gatt.connected) {
      deviceCache.gatt.disconnect();
      log('"' + deviceCache.name + '" bluetooth device disconnected');
    }
    else {
      log('"' + deviceCache.name +
          '" bluetooth device is already disconnected');
    }
  }

  // Добавленное условие
  if (characteristicCache) {
    characteristicCache.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
    characteristicCache = null;
  }

  charArray = null;
  serviceInstance = null;
  deviceCache = null;
}

// Получение коэффициента
function handleCoefficientValueChanged(event) {
  log("coefficient " + event.target.value.getInt16(0), 'in'); // (0, littleEndian)
  inputField.value = event.target.value.getInt16(0) ;
  coefficient_freq = event.target.value.getInt16(0) ;
}

// Получение данных
function handleCharacteristicValueChanged(event) {
  log(event.target.value.getInt32(0)/100, 'in'); // (0, littleEndian)
  vibrospeedLabel.innerHTML =  event.target.value.getInt32(0)/100 ;
}

function int16ToInt8Array(value) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [(value >> 8) & 0xFF, value & 0xFF];

    // for (var index = 0; index < byteArray.length; index++) {
      // var byte = value & 0xff;
      // byteArray[index] = byte;
      // value = (value - byte) / 256;
    // }

    return new Int8Array(byteArray);
};

// Отправить данные подключенному устройству
function send() {
  var uuid = $('#input').attr('data-uuid');
  var value = $('#input').val();
  var characteristic = charArray[uuid].characteristic;
  var converted = int16ToInt8Array(value);
  characteristic.writeValue(converted);
}

var stg = 0;
var datau = [];


