// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
let startButton = document.getElementById('startBtn');
let fftStartButton = document.getElementById('fftStartBtn');
let rawDataStartButton = document.getElementById('rawDataStartBtn');
let fftSaveButton = document.getElementById('fftSaveBtn');
let stopButton = document.getElementById('stopBtn');
let clearButton = document.getElementById('clrBtn');
//let attCheckbox = document.getElementById('attenuator');
//let hz1600Checkbox = document.getElementById('HZ1600');

let vibrospeedLabel = document.getElementById('vibrospeed');
let graphDiv = document.getElementById('div_v');
let graphLab = document.getElementById('labdiv');


var pic32_fft_points = 3*4096
var pic32_fft_len = 3*4096
var pic32_sample_freq = 3200
var n_points = 4096 ;
var fftByteArray = new Uint16Array(3*4096+10);
var rawDataByteArray = new Int16Array(3*4096+10);

var devicename = 'data' ;

var coefficient_freq = 10000 ;

function add_cfg_bits(in_byte) {
  str = ''
  if (!$('#attenuator').is(':checked')){
    in_byte |= 0x04 ;
    str += ' ATT Выключен ' ;
  } 
  if ($('#once').is(':checked')){
    in_byte |= 0x02 ;
    str += ' однократно ' ;
  } 
  if ($('#HZ1600').is(':checked')){
    in_byte |= 0x08 ;
	str += ' HZ1600 ' ;
  } 
  if ($('#adxl_1ms').is(':checked')){
    in_byte |= 0x0040 ;
	str += ' adxl_1ms ' ;
  } 
  if ($('#adxl_fifo').is(':checked')){
    in_byte |= 0x0080 ;
	str += ' adxl_fifo ' ;
  } 
  if ($('#p4096').is(':checked')){
    in_byte |= 0x0100 ;
	str += ' p4096 ' ;
  } 
  if ($('#p1024').is(':checked')){
    in_byte |= 0x0200 ;
	str += ' p1024 ' ;
  } 
  if ($('#f200').is(':checked')){
    in_byte |= 0x1000 ;
	str += ' f200 ' ;
  } 
  if ($('#f400').is(':checked')){
    in_byte |= 0x2000 ;
	str += ' f400 ' ;
  } 
  if ($('#f1000').is(':checked')){
    in_byte |= 0x1000 ;
    in_byte |= 0x2000 ;
	str += ' f1000 ' ;
  } 
  if ($('#setnul').is(':checked')){
    in_byte |= 0x0400 ;
	str += ' setnul ' ;
  } 
  if ($('#x2dead').is(':checked')){
    in_byte |= 0x4000 ;
	str += ' x2DEADZONE ' ;
  } 
  if ($('#x3dead').is(':checked')){
    in_byte |= 0x8000 ;
	str += ' x3DEADZONE ' ;
  } 
  if ($('#x1_fft  ').is(':checked')){
    in_byte |= 0x0800 ;
	str += ' x1_fft   ' ;
  } 
  if ($('#axis_X').is(':checked')){
    in_byte |= 0x08 ;
	str += ' axis_X ' ;
  } 
  if ($('#axis_Y').is(':checked')){
    in_byte |= 0x0400 ;
	str += ' axis_Y ' ;
  } 

  log(str);
  return in_byte ;
}

// при нажатии на кнопку START
startButton.addEventListener('click', function() {
  log('start');
  var uuid = $('#startBtn').attr('data-uuid');
  var value = 0x01 ; // $('#startBtn').attr('data-value');
  value = add_cfg_bits(value) ;
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint16Array([value]);
  characteristic.writeValue(converted);
});

// при нажатии на кнопку FFTSTART
fftStartButton.addEventListener('click', function() {
  log('fftstart');
  var uuid = $('#startBtn').attr('data-uuid');
  var value = 0x11 ; // $('#startBtn').attr('data-value');
  value = add_cfg_bits(value) ;
  
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint16Array([value]);
  characteristic.writeValue(converted);
});

// при нажатии на кнопку RAWDATA_START
rawDataStartButton.addEventListener('click', function() {
  log('rawdata_start');
  var uuid = $('#startBtn').attr('data-uuid');
  var value = 0x21 ; 
  value = add_cfg_bits(value) ;
  
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
  ShowGrf();
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
                case '0000aa85-0000-1000-8000-00805f9b34fb':
				  fftCharacteristic = characteristic;
				  fftCharacteristic.addEventListener('characteristicvaluechanged', handleFftChanged);
				  //fftCharacteristic.startNotifications(); // на андроиде не работает
                  _val  = 0 ;
                  _dat = 'int16';
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

// Получение fft data
function handleFftChanged(event) {
  var block = event.target.value.getUint8(0) ;
  
  if(block == 0x7E) { //приём виброскоростиь по трём координатам
    log(event.target.value.getInt32(1, true)/100 + '    [' + event.target.value.getInt16(5, true)/100 + ',   ' + event.target.value.getInt16(7, true)/100 + ',   ' + event.target.value.getInt16(9, true)/100 + ']    ' + event.target.value.getInt32(11, true) + '  lines ' + event.target.value.getInt16(15, true) , 'in'); 
    vibrospeedLabel.innerHTML =  event.target.value.getInt32(1, true)/100 + '    [' + event.target.value.getInt16(5, true)/100 + ',   ' + event.target.value.getInt16(7, true)/100 + ',   ' + event.target.value.getInt16(9, true)/100 + ']    ' + event.target.value.getInt32(11, true) + '  lines ' + event.target.value.getInt16(15, true) ;
  } else if(block < 0x80) { //приём 75 блоков FFT
      if(block == 0x7F) {
		n_points          = event.target.value.getUint16(1+0, true)*9 ;
		pic32_fft_points  = event.target.value.getUint16(1+2, true) ;
		pic32_fft_len     = event.target.value.getUint16(1+4, true) ;
		pic32_sample_freq = event.target.value.getUint16(1+6, true) ;
		coefficient_freq  = event.target.value.getUint16(1+8, true) ;
		inputField.value = coefficient_freq ;

		if(pic32_fft_points > pic32_fft_len) {pic32_fft_points = pic32_fft_len ;}

		console.log('fft data ' + n_points + ' ' + pic32_fft_points + ' ' + pic32_fft_len + ' ' + pic32_sample_freq + ' ' + coefficient_freq);

		datau = [] ;
		var freq ;
		var deadzone ;
		for (let i=1;i<n_points;i+=1) { 
            freq = (i*(pic32_fft_points/n_points)*(pic32_sample_freq/pic32_fft_len)*(10000/coefficient_freq)) ; 
            if ($('#fft_velocity').is(':checked')){
                //velocity_fft[i] = Math.pow(velocity_fft[i]* pow( G_MM_S2 * MM_IN_METER, 2) / (4 * pow(pi, 2)), 0.5) / pow(2, 0.5)
                //print(pow( pow( G_MM_S2 * MM_IN_METER, 2) / (4 * pow(pi, 2)), 0.5) / pow(2, 0.5))
                
                deadzone = 0.004 ;
                if ($('#x2dead').is(':checked')) { deadzone *= 2 ; }
                else if ($('#x3dead').is(':checked')) { deadzone *= 3 ; }
                
                if( (freq > 9.5) && ((fftByteArray[i]/4000) >= deadzone) )  {
                    datau.push([freq, 1103.6358752302604* (fftByteArray[i]/4000) / freq]); 
                } else {
                    datau.push([freq, 0 ]); 
                }
            } else {
                datau.push([freq, fftByteArray[i]/4000]); 
            }
        }
		console.log(datau);
		ShowGrf();
		freq = 0 ; datau.push([freq, fftByteArray[0]/4000]);
      } else {
		fftByteArray[block*9+0] = event.target.value.getUint16(1+0, true) ;
		fftByteArray[block*9+1] = event.target.value.getUint16(1+2, true) ;
		fftByteArray[block*9+2] = event.target.value.getUint16(1+4, true) ;
		fftByteArray[block*9+3] = event.target.value.getUint16(1+6, true) ;
		fftByteArray[block*9+4] = event.target.value.getUint16(1+8, true) ;
		fftByteArray[block*9+5] = event.target.value.getUint16(1+10, true) ;
		fftByteArray[block*9+6] = event.target.value.getUint16(1+12, true) ;
		fftByteArray[block*9+7] = event.target.value.getUint16(1+14, true) ;
		fftByteArray[block*9+8] = event.target.value.getUint16(1+16, true) ;
		console.log(block + ' ' + fftByteArray[block*9+0]);
	  }
  } else { //приём 4096*2/9 блоков сырых данных
      var block = event.target.value.getUint16(0, false) ;
      if(block ==  0xFFFF) { // 4096*2/9 
		pic32_fft_points  = event.target.value.getUint16(2+0, false) ;
		pic32_fft_len     = event.target.value.getUint16(2+2, false) ;
		pic32_sample_freq = event.target.value.getUint16(2+4, false) ;
		coefficient_freq  = event.target.value.getUint16(2+6, false) ;
		inputField.value = coefficient_freq ;
		
		if(pic32_fft_points > pic32_fft_len) {pic32_fft_points = pic32_fft_len ;}

		console.log('rawpoint data ' + pic32_fft_points + ' ' + pic32_fft_len + ' ' + pic32_sample_freq + ' ' + coefficient_freq);

        datau = [] ;
        for (let i=0;i<pic32_fft_points;i+=1) { datau.push([i, rawDataByteArray[i]]); }
        console.log(datau);
        ShowGrf();
      } else {
		block -= 0x8000 ;
		rawDataByteArray[block*9+0] = event.target.value.getInt16(2+0, false) ;
		rawDataByteArray[block*9+1] = event.target.value.getInt16(2+2, false) ;
		rawDataByteArray[block*9+2] = event.target.value.getInt16(2+4, false) ;
		rawDataByteArray[block*9+3] = event.target.value.getInt16(2+6, false) ;
		rawDataByteArray[block*9+4] = event.target.value.getInt16(2+8, false) ;
		rawDataByteArray[block*9+5] = event.target.value.getInt16(2+10, false) ;
		rawDataByteArray[block*9+6] = event.target.value.getInt16(2+12, false) ;
		rawDataByteArray[block*9+7] = event.target.value.getInt16(2+14, false) ;
		rawDataByteArray[block*9+8] = event.target.value.getInt16(2+16, false) ;
		console.log(block + ' ' + rawDataByteArray[block*9+0]);
	  }
  }
}

// Получение коэффициента
function handleCoefficientValueChanged(event) {
  log("coefficient " + event.target.value.getInt16(0), 'in'); // (0, littleEndian)
  inputField.value = event.target.value.getInt16(0) ;
  coefficient_freq = event.target.value.getInt16(0) ;
  fftCharacteristic.startNotifications();
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

function ShowGrf() {
	if(!stg) {
		gu = new Dygraph(
			graphDiv,
		    datau, //fftByteArray,
			{
				title: 'спектр ускорений',
				showRangeSelector: false, //true,
				showRoller: false, //true,
				xlabel: 'f(Hz)',
				ylabel: 'амплитуда',
				colors: ['green'],
				axes: {
					x: {valueFormatter: function(x){return this.getLabels()[0] + ': '+ x.toPrecision(5);}}},
					labels: ['Hz', 'a'],
					labelsDiv: graphLab,
					legend: "follow", //'always',  // "follow"
					digitsAfterDecimal: 3,
			});
//		setInterval(function(){renderChart()}, 50);
		stg = 0;
	} else {
		gu.updateOptions({'file': datau});
	}
}

var renderChart = function() {
	var dl;
	if (gu.dateWindow_) {
		dl = gu.dateWindow_[1] - gu.dateWindow_[0];
	    if ($("FixEnd").checked) {
			var ls = datau.length - 1;
			gu.dateWindow_[1] = datau[ls][0];
			gu.dateWindow_[0] = datau[ls][0] - dl;
		} else if (gu.dateWindow_[0] < datau[0][0]) {
			gu.dateWindow_[0] = datau[0][0];
			gu.dateWindow_[1] = datau[0][0] + dl;
	   	}
	} else dl = datau.length/smprate;
	if(rend && datau.length != 0) gu.updateOptions({'file': datau});
}

function convertArrayOfObjectsToCSV(value){
	var result, ctr, keys, columnDelimiter, lineDelimiter, data;

	data = value.data || null;
	if (data == null || !data.length) {return null;}
	columnDelimiter = value.columnDelimiter || ';';
	lineDelimiter = value.lineDelimiter || '\n';
	keys = Object.keys(data[1]);
	result = '';
	//result += vibrospeedLabel.innerHTML + " mm/s" + lineDelimiter;
	//result += keys.join(columnDelimiter);
	//result += lineDelimiter;
	data.forEach(function(item){
		ctr = 0;
		keys.forEach(function(key){
			if (ctr > 0)
				result += columnDelimiter;
			result += item[key].toFixed(3).replace(".",",");
			ctr++;
		});
		result += lineDelimiter;
	});
	return result;
}

// при нажатии на кнопку FFTSAVE
fftSaveButton.addEventListener('click', function() {
  log('fftsave to csv');
  var csv = convertArrayOfObjectsToCSV({data: datau});
  if (!csv.match(/^data:text\/csv/i)) {csv = 'data:text/csv;charset=utf-8,' + csv;}
  var encodedUri = encodeURI(csv);
  var link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  if ($('#HZ1600').is(':checked')){
    link.setAttribute('download',devicename.replace("#","")+"_1600_"+vibrospeedLabel.innerHTML+".csv");
  } else {
    link.setAttribute('download',devicename.replace("#","")+"_"+vibrospeedLabel.innerHTML+".csv");
  }  
  

  link.click();
});

