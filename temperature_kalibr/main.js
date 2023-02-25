// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let startButton = document.getElementById('startBtn');
let stopButton = document.getElementById('stopBtn');
let clearButton = document.getElementById('clrBtn');
let temperatureLabel = document.getElementById('temperature');
let tableReadButton = document.getElementById('tableRead');
let tableWriteButton = document.getElementById('tableWrite');
let tableArea = document.getElementById('tableCorrection');
let auto_m30Button = document.getElementById('AUTO_m30');
let auto_m10Button = document.getElementById('AUTO_m10');
let auto_50Button = document.getElementById('AUTO_50');
let auto_100Button = document.getElementById('AUTO_100');
let auto_200Button = document.getElementById('AUTO_200');
let auto_280Button = document.getElementById('AUTO_280');

// при нажатии на кнопку START
startButton.addEventListener('click', function() {
  log('start');
  var uuid = $('#startBtn').attr('data-uuid');
  var value = 0x01 ; // $('#startBtn').attr('data-value');
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint8Array([value]);
  characteristic.writeValue(converted);
});


// при нажатии на кнопку STOP
stopButton.addEventListener('click', function() {
  log('stop');
  var uuid = $('#stopBtn').attr('data-uuid');
  var value = $('#stopBtn').attr('data-value');
  var characteristic = charArray[uuid].characteristic;
  var converted = new Uint8Array([value]);
  characteristic.writeValue(converted);
});

// при нажатии на кнопку CLEAR
clearButton.addEventListener('click', function() {
  log('clear');
  terminalContainer.innerHTML = "";
});

// при нажатии на кнопку tableRead
tableReadButton.addEventListener('click', function() {
  log('table read');
  tableArea.value = '' ;
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_DATA, new Uint16Array([0]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}


// при нажатии на кнопку tableWrite
tableWriteButton.addEventListener('click', function() {
  log('table write');
  
  var lines = tableArea.value.split('\n');
  for(var i = 0;i < lines.length;i++){
	if(lines[i].length > 0) {
		console.log("send " + lines[i]) ;
		var curr_line = lines[i].split(',');
		console.log(curr_line) ;
		if(curr_line.length < 3) { // количество
		 var _count = parseInt(curr_line[0]);
		 wake_build_packet(COMM_ADDR_BIN_CHANNEL, COMM_TYPE_PYRO_KALIBR_DATA, new Uint8Array([0xFF, _count, (_count >> 8)]), 3);
		 debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
		} else 
		if(curr_line.length == 3) { // значения
		 var _index = parseInt(curr_line[0]);
		 var _temperature = parseInt(curr_line[1]);
		 var _att_value = parseInt(curr_line[2]);
		 wake_build_packet(COMM_ADDR_BIN_CHANNEL, COMM_TYPE_PYRO_KALIBR_DATA, new Uint8Array([_index, _temperature, (_temperature >> 8), _att_value, (_att_value >> 8)]), 5);
		 debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
		}
		sleep(100);
	}
  }
});


// при нажатии на кнопку auto
auto_m30Button.addEventListener('click', function() {
  var cal_temperature = -30 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

// при нажатии на кнопку auto
auto_m10Button.addEventListener('click', function() {
  var cal_temperature = -10 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

// при нажатии на кнопку auto
auto_50Button.addEventListener('click', function() {
  var cal_temperature = 50 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

// при нажатии на кнопку auto
auto_100Button.addEventListener('click', function() {
  var cal_temperature = 100 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

// при нажатии на кнопку auto
auto_200Button.addEventListener('click', function() {
  var cal_temperature = 200 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
});

// при нажатии на кнопку auto
auto_280Button.addEventListener('click', function() {
  var cal_temperature = 280 ;
  log('auto '+cal_temperature);
  wake_build_packet(COMM_ADDR_CFG_CHANNEL, COMM_TYPE_PYRO_KALIBR_MODE, new Uint16Array([cal_temperature]), 2);
  debugPipeInOutCharacteristic.writeValue(new Uint8Array(wake_out_buf));
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


// Кэш объекта выбранного устройства
let deviceCache = null;

let coefficientValueCharacteristic = null;
let fftCharacteristic = null;
let debugPipeInOutCharacteristic = null;

// Запустить выбор Bluetooth устройства и подключиться к выбранному
function connect() {
  var _dev = (deviceCache ? Promise.resolve(deviceCache) : requestBluetoothDevice());
  _dev.then(device => showValues(device));
  return _dev
    .then(device => connectDeviceAndCacheCharacteristic(device))
    .then(characteristic => startNotifications(characteristic))
	.then(_ => {
    return debugPipeInOutCharacteristic.startNotifications();
  })
    .catch(error => log(error));
}

// Запрос выбора Bluetooth устройства
function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
	  // acceptAllDevices: true,
    filters: [
	   {namePrefix: 'AB4'}
	  ],
	  optionalServices: [0xAA00, 'f000c0e0-0451-4000-b000-000000000000']
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

function getPrimaryService(device, param) {
  return serviceInstance
    ? Promise.resolve(serviceInstance)
    : device.gatt.connect()
      .then(server => {
        //log('GATT server connected, getting service...');
        serviceInstance = server ;
        if(param <= 0xAA05) {
            return server.getPrimaryService(0xAA00);
        } else {
            return server.getPrimaryService('f000c0e0-0451-4000-b000-000000000000');
        }
        
      });
}

function readCharacteristic(device, param) {
  return getPrimaryService(device, param)
    .then(service => {
      return service.getCharacteristic(param);
    });
}

function showValues(device) {
  var chars = ['f000c0e1-0451-4000-b000-000000000000', 0xAA01, 0xAA02];
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
                case '0000aa01-0000-1000-8000-00805f9b34fb':
                  _val = 0 ; // value.getUint32(0);
                  _dat = 'uint32';
                  break;
                case '0000aa02-0000-1000-8000-00805f9b34fb':
                  _val = 0 ; // value.getUint8(0);
                  $('#startBtn')
                    .attr('data-uuid', uuid)
                    .attr('data-value', 1);
                  $('#stopBtn')
                    .attr('data-uuid', uuid)
                    .attr('data-value', 0);
                  _dat = 'uint16';
                  break;
                case 'f000c0e1-0451-4000-b000-000000000000':
				  debugPipeInOutCharacteristic = characteristic;
				  debugPipeInOutCharacteristic.addEventListener('characteristicvaluechanged', debugPipeInValueChanged);
				  //debugPipeInOutCharacteristic.startNotifications(); // на андроиде не работает
                  log('debugPipeIn OK');
                  
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
  return getPrimaryService(device, 0xAA01)
    .then(service => {
      log('Service found, getting characteristic...');

      return service.getCharacteristic(0xAA01);
    })
    .then(characteristic => {
      log('Characteristic found');
      characteristicCache = characteristic;

      return characteristicCache;
    });
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


// Получение данных
function handleCharacteristicValueChanged(event) {
    log(event.target.value.getInt32(0)/100, 'in'); // (0, littleEndian)
    temperatureLabel.innerHTML =  event.target.value.getInt32(0)/100 ;
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

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join(' ')
}

// Получение debug data
function debugPipeInValueChanged(event) {
  let bytes = new Uint8Array(event.target.value.buffer) ;
  var parse_status ;
  
  //console.log("debug in [" + toHexString(bytes) + "]");
/*  
  var s = "";
  //for(let i=0; i < bytes.length; i+=1) { s += String.fromCharCode(bytes[i]); }
  for(let i=0; i < bytes.length; i+=1) { s += bytes[i].toString(16); }
  log("debug in" + s);
*/

  for (var i=0; i<bytes.length; i++) {
	 parse_status = parser_wake(bytes[i]);
	 
	 if (parse_status == RX_DONE) {
	  console.log("[RX_DONE] ADDR=" + Rx_Add, " CMD=" + Rx_Cmd, " DATA:", Rx_Dat);
      Rx_Sta = WAIT_FEND;
	  
	  if(Rx_Add == COMM_ADDR_CFG_CHANNEL) {
      } else 
	  if(Rx_Add == COMM_ADDR_BIN_CHANNEL) {
		if(Rx_Cmd == COMM_TYPE_PYRO_KALIBR_DATA) {
			//приём таблицы коэффициентов
			if(Rx_Dat[0] == 0xFF) { //количество
				var _count ;
				_count = (Rx_Dat[2] << 8) + Rx_Dat[1] ;
				tableArea.value +=  _count + '\r\n' ;
			} else {
				var _index, _temperature, _att_value ;
				
				_index = Rx_Dat[0] ;
				_temperature = ((Rx_Dat[2] << 8) + Rx_Dat[1]) ;
				if (_temperature > 0x7FFF) { _temperature -= 0x10000 ; }
				_att_value = (Rx_Dat[4] << 8) + Rx_Dat[3] ;
				tableArea.value += _index + ',\t' + _temperature + ',\t' + _att_value + '\r\n' ;
			}
		}
	  }
	 }//parse_status == RX_DONE
	 
   }
  
}


// Отправить данные подключенному устройству
function send() {
  var uuid = $('#input').attr('data-uuid');
  var value = $('#input').val();
  var characteristic = charArray[uuid].characteristic;
  var converted = int16ToInt8Array(value);
  characteristic.writeValue(converted);
}


//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
//WAKE
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
const COMM_ADDR_TPT_CHANNEL = 0x11 ; // ïðîçðà÷êà
const COMM_ADDR_CFG_CHANNEL = 0x12 ; // cfg
const COMM_ADDR_BIN_CHANNEL = 0x13 ; // data
const COMM_ADDR_PRD_CHANNEL = 0x14 ; // ïåðèîä
const COMM_ADDR_DBG_CHANNEL = 0x15 ; // îòëàäî÷íûé UART

const COMM_TYPE_NOTHING = 4 ;
const COMM_TYPE_DIN_DATA = 5 ;
const COMM_TYPE_DEVICE_SELECT_TYPE = 6 ;
const COMM_TYPE_VELOCITY_DATA = 7 ;
const COMM_TYPE_TEMPERATURE_DATA = 8 ;
const COMM_TYPE_RFID_DATA = 9 ;
const COMM_TYPE_DISCRETE_DATA = 10 ;
const COMM_TYPE_COMM_CONFIG = 11 ;
const COMM_TYPE_COMM_STATUS_DATA = 12 ;
const COMM_TYPE_BATTERY_DATA = 13 ;
const COMM_TYPE_RESTART = 14 ;
const COMM_TYPE_DBG_DATA = 15 ;
const COMM_TYPE_RFID_EXTDATA = 16 ;
const COMM_TYPE_VELOCITY_EXTDATA = 17 ;
const COMM_TYPE_VELOCITY_FFTDATA = 18 ;
const COMM_TYPE_KALIBR_MODE = 19 ;
const COMM_TYPE_KALIBR_DATA = 20 ;
const COMM_TYPE_PYRO_KALIBR_MODE = 21 ;
const COMM_TYPE_PYRO_KALIBR_DATA = 22 ;

const KALIBR_MODE_1KHZ  = 0x0001 ;
const KALIBR_MODE_10MMS = 0x0002 ;
const KALIBR_MODE_5MMS  = 0x0004 ;


//стандартные
const CMD_NOP         = 0x00 ; // Нет операции
const CMD_ERR         = 0x01 ; // Передача кода ошибки
const CMD_ECHO        = 0x02 ; // Запрос возврата переданного пакета
const CMD_INFO        = 0x03 ; // Запрос информации об устройстве
const CMD_SETADDR     = 0x04 ; // Установка адреса устройства
const CMD_GETADDR     = 0x05 ; // Чтение адреса устройства
//пользовательские     
const CMD_SETMODE     = 0x06 ; // Установка режима работы
const CMD_GETMODE     = 0x07 ; // Чтение режима работы
const CMD_DATA        = 0x08 ; // Передача данных, виброскорость
const CMD_RAW_DATA    = 0x09 ; // Передача сырых данных акселерометра
const CMD_FFT_DATA    = 0x0A ; // Передача данных разложения в спектр 
const CMD_SETCFG      = 0x0B ; // Установка коэфиициента
const CMD_GETCFG      = 0x0C ; // Чтение коэфиициента
const CMD_REPLY_FLAG  = 0x40 ; // ACK


const VIBRO_CONFIG_BIT_START =   0x0001 // запустить измерение вибрации
const VIBRO_CONFIG_BIT_ONCE  =   0x0002 // измерять и передавать постоянно, пока MODE_BYTE_RUN, или остановиться после одного прохода
const VIBRO_CONFIG_BIT_FFT   =   0x0010 // передавать спектр FFT
const VIBRO_CONFIG_BIT_RAW   =   0x0020 // передавать сырые данные с акселерометра





const  FEND  = 0xC0 ;   //Frame END
const  FESC  = 0xDB ;   //Frame ESCape
const  TFEND = 0xDC ;   //Transposed Frame END
const  TFESC = 0xDD ;   //Transposed Frame ESCape
const  CRC_INIT = 0xDE ; //Innitial CRC value
const  FRAME = 200 ;    //максимальная длина пакета
var wake_out_buf = [] ; // new Uint8Array() ; // [] ;

//--------------------- Вычисление контрольной суммы: ------------------------
function Do_Crc8(b, crc)
{
  for(var i = 0; i < 8; b = b >> 1, i++)
    if((b ^ crc) & 1) crc = ((crc ^ 0x18) >> 1) | 0x80;
     else crc = (crc >> 1) & ~0x80;
     
  return crc ;
}

//добавление байта в поток WAKE, если совпадает со спецсимволом - заменяем на пару
function make_wake_byte(_byte)
{
 var _result = 0 ;
 if(_byte == FEND) {
     // FESC TFEND
     _result = (TFEND << 8) | FESC;
 } else if(_byte == FESC) {
     // FESC TFESC
     _result = (TFESC << 8) | FESC;
 } else {
     // _byte
     _result = _byte ;
 }
 return(_result);
}


// фомирование пакета для передачи
// на выходе wake_out_buf
// использование
// wake_build_packet(0x15, 0x0F, new Uint8Array([0x53, 0x54, 0x41, 0x52, 0x54]), 0x05);
// serialController.write_raw(new Uint8Array(wake_out_buf));
function wake_build_packet(_addr, _cmd, _in_data, _n_bytes)
{
 var out_bytes = 0 ;
 var wake_byte = 0 ;

 console.log('SEND ['+ _addr.toString(16)+']('+_cmd.toString(16)+') '+_in_data.toString(16));
 
 wake_out_buf = wake_out_buf.slice(0, 0) ;
 
 var _crc = CRC_INIT ;
 
 _crc = Do_Crc8(FEND, _crc);
 _crc = Do_Crc8(_addr, _crc);
 _crc = Do_Crc8(_cmd, _crc);
 _crc = Do_Crc8(_n_bytes, _crc);
 for(var _i=0; _i<_n_bytes; _i++) {
      _crc = Do_Crc8(_in_data[_i], _crc);
  }
 
 wake_out_buf.push(FEND);
 wake_out_buf.push(0x80|_addr);
 wake_out_buf.push(_cmd & 0x7F);
 
 wake_byte = make_wake_byte(_n_bytes) ;
 wake_out_buf.push(wake_byte);
 if(wake_byte & 0xFF00) wake_out_buf.push(wake_byte >> 8);
 
 for(var _i=0; _i<_n_bytes; _i++) {
	 wake_byte = make_wake_byte(_in_data[_i]);
	 wake_out_buf.push(wake_byte);
	 if(wake_byte & 0xFF00) wake_out_buf.push(wake_byte >> 8);
 }
 
 wake_byte = make_wake_byte(_crc) ;
 wake_out_buf.push(wake_byte);
 if(wake_byte & 0xFF00) wake_out_buf.push(wake_byte >> 8);
 
// console.log('WAKE outdata', wake_out_buf);
}


// переменые для приёма
var  Rx_Sta,        //состояние процесса приема пакета
     Rx_Pre,        //предыдущий принятый байт
     Rx_Add,        //адрес, с которым сравнивается принятый
     Rx_Cmd,        //принятая команда
     Rx_Nbt,        //принятое количество байт в пакете
     Rx_Dat = [],   //массив принятых данных
     Rx_Crc,        //контрольная сумма принимаемого пакета
     Rx_Ptr;        //указатель на массив принимаемых данных

//RX process states:
const  WAIT_FEND = 0 ; //ожидание приема FEND
const  WAIT_ADDR = 1 ; //ожидание приема адреса
const  WAIT_CMD  = 2 ; //ожидание приема команды
const  WAIT_NBT  = 3 ; //ожидание приема количества байт в пакете
const  WAIT_DATA = 4 ; //прием данных
const  WAIT_CRC  = 5 ; //ожидание окончания приема CRC
const  RX_DONE   = 6 ; //успешно принят новый пакет
const  WAIT_CARR = 7 ; //ожидание несущей

// WAKE приём, побайтово
function parser_wake(data_byte)
{
//console.log(data_byte, Rx_Sta, Rx_Nbt, Rx_Ptr, Rx_Crc);
  if(data_byte == FEND)               //если обнаружено начало фрейма,
  {
    Rx_Pre = data_byte;               //то сохранение пре-байта,
    Rx_Crc = CRC_INIT;                //инициализация CRC,
    Rx_Sta = WAIT_ADDR;               //сброс указателя данных,
    Rx_Crc = Do_Crc8(data_byte, Rx_Crc);      //обновление CRC,
    return(Rx_Sta);                           //выход
  }

  if(Rx_Sta == WAIT_FEND)             //-----> если ожидание FEND,
      return(Rx_Sta);                           //то выход

  var Pre = Rx_Pre;                  //сохранение старого пре-байта
  Rx_Pre = data_byte;                 //обновление пре-байта
  if(Pre == FESC)                     //если пре-байт равен FESC,
  {
    if(data_byte == TFESC)            //а байт данных равен TFESC,
      data_byte = FESC;               //то заменить его на FESC
    else if(data_byte == TFEND)       //если байт данных равен TFEND,
           data_byte = FEND;          //то заменить его на FEND
         else
         {
           Rx_Sta = WAIT_FEND;        //для всех других значений байта данных,
           return(Rx_Sta);
         }
  }
  else
  {
    if(data_byte == FESC)             //если байт данных равен FESC, он просто
        return(Rx_Sta);                         //запоминается в пре-байте
  }

  switch(Rx_Sta)
  {
  case WAIT_ADDR:                     //-----> ожидание приема адреса
    {
      if(data_byte & 0x80)            //если бит 7 данных не равен нулю, то это адрес
      {
        data_byte = data_byte & 0x7F; //обнуляем бит 7, получаем истинный адрес
//        if(data_byte == 0 || data_byte == Rx_Add) //если нулевой или верный адрес,
Rx_Add = data_byte ;
        if(1) // принимаем всё
        {
          Rx_Crc = Do_Crc8(data_byte, Rx_Crc); //то обновление CRC и
          Rx_Sta = WAIT_CMD;          //переходим к приему команды
          break;
        }
        Rx_Sta = WAIT_FEND;           //адрес не совпал, ожидание нового пакета
        break;
      }                               //если бит 7 данных равен нулю, то
      Rx_Sta = WAIT_CMD;              //сразу переходим к приему команды
    }
  case WAIT_CMD:                      //-----> ожидание приема команды
    {
      if(data_byte & 0x80)            //проверка бита 7 данных
      {
        Rx_Sta = WAIT_FEND;           //если бит 7 не равен нулю,
        break;
      }
      Rx_Cmd = data_byte;             //сохранение команды
      Rx_Crc = Do_Crc8(data_byte, Rx_Crc);    //обновление CRC
      Rx_Sta = WAIT_NBT;              //переходим к приему количества байт
      break;
    }
  case WAIT_NBT:                      //-----> ожидание приема количества байт
    {
      if(data_byte > FRAME)           //если количество байт > FRAME,
      {
        Rx_Sta = WAIT_FEND;
        break;
      }
      Rx_Nbt = data_byte;
      Rx_Crc = Do_Crc8(data_byte, Rx_Crc);    //обновление CRC
      Rx_Ptr = 0;                     //обнуляем указатель данных
      Rx_Sta = WAIT_DATA;             //переходим к приему данных
      break;
    }
  case WAIT_DATA:                     //-----> ожидание приема данных
    {
      if(Rx_Ptr < Rx_Nbt)             //если не все данные приняты,
      {
        Rx_Dat[Rx_Ptr++] = data_byte; //то сохранение байта данных,
        Rx_Crc = Do_Crc8(data_byte, Rx_Crc);  //обновление CRC
        break;
      }
      if(data_byte != Rx_Crc)         //если приняты все данные, то проверка CRC
      {
        Rx_Sta = WAIT_FEND;           //если CRC не совпадает,
        break;
      }
      Rx_Sta = RX_DONE ;             //прием пакета завершен,
      break;
    }
  }

  return(Rx_Sta);
}
