// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let startButton = document.getElementById('startBtn');
let stopButton = document.getElementById('stopBtn');
let clearButton = document.getElementById('clrBtn');
let temperatureLabel = document.getElementById('temperature');

// Новые элементы для калибровки
let tableReadButton = document.getElementById('tableRead');
let tableWriteButton = document.getElementById('tableWrite');
let tableArea = document.getElementById('tableCorrection');

// Кэш объектов
let deviceCache = null;
let charArray = null;
let gattServer = null;
let modeSelectCharacteristic = null;
let debugPipeInOutCharacteristic = null;

// UUID сервисов и характеристик
const SERVICES = {
    MAIN: 0xAA80,
    DEBUG: 'f000deb0-0451-4000-b000-000000000000'
};

const CHARACTERISTICS = {
    TEMPERATURE: 0xAA01,
    START_STOP: 0xAA02,
    MODE_SELECT: 0xAA65,
    DEBUG_PIPE: 'f000deb1-0451-4000-b000-000000000000'
};

// Константы для калибровки
const COMM_TYPE_KALIBR_DATA = 20;
const CMD_GET_KALIBR_DATA = 0x10;
const CMD_SET_KALIBR_DATA = 0x0F;

// Вспомогательная функция для задержки
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для преобразования строки в hex байты (для отладки)
function toHexString(byteArray) {
    return Array.from(byteArray, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join(' ');
}

// Функция для преобразования int16 из байтов (little endian)
function bytesToInt16(bytes, offset = 0) {
    let value = (bytes[offset + 1] << 8) | bytes[offset];
    // Преобразование в знаковое значение
    if (value & 0x8000) {
        value = value - 0x10000;
    }
    return value;
}

// Функция для преобразования int16 в байты (little endian)
function int16ToBytes(value) {
    let bytes = new Uint8Array(2);
    if (value < 0) {
        value = 0x10000 + value; // Преобразование в дополнительный код
    }
    bytes[0] = value & 0xFF;
    bytes[1] = (value >> 8) & 0xFF;
    return bytes;
}

// при нажатии на кнопку tableRead - чтение таблицы калибровки
tableReadButton.addEventListener('click', function() {
    if (!debugPipeInOutCharacteristic) {
        log('Сначала подключитесь к устройству', 'error');
        return;
    }
    
    log('Запрос таблицы калибровки...');
    tableArea.value = '';
    // Отправляем команду на чтение таблицы
    debugPipeInOutCharacteristic.writeValue(new Uint8Array([CMD_GET_KALIBR_DATA, 0]))
        .then(() => log('Команда на чтение таблицы отправлена', 'success'))
        .catch(error => log('Ошибка чтения таблицы: ' + error, 'error'));
});

// при нажатии на кнопку tableWrite - запись таблицы калибровки
tableWriteButton.addEventListener('click', async function() {
    if (!debugPipeInOutCharacteristic) {
        log('Сначала подключитесь к устройству', 'error');
        return;
    }
    
    log('Запись таблицы калибровки...');
    
    var lines = tableArea.value.split('\n');
    for(var i = 0; i < lines.length; i++) {
        if(lines[i].length > 0) {
            console.log("send " + lines[i]);
            var curr_line = lines[i].split(',');
            console.log(curr_line);
            
            try {
                if(curr_line.length < 3) {
                    // Строка с количеством записей
                    var _count = parseInt(curr_line[0]);
                    if (!isNaN(_count)) {
                        await debugPipeInOutCharacteristic.writeValue(
                            new Uint8Array([CMD_SET_KALIBR_DATA, 0xFF, _count & 0xFF, (_count >> 8) & 0xFF])
                        );
                        log(`Отправлено количество: ${_count}`, 'success');
                    }
                } else if(curr_line.length >= 3) {
                    // Строка с данными: индекс, температура, значение
                    var _index = parseInt(curr_line[0]);
                    var _temperature = parseFloat(curr_line[1]); // Температура со знаком
                    var _att_value = parseInt(curr_line[2]);
                    
                    if (!isNaN(_index) && !isNaN(_temperature) && !isNaN(_att_value)) {
                        let tempInt = Math.round(_temperature);
                        let tempBytes = int16ToBytes(tempInt);
                        
                        await debugPipeInOutCharacteristic.writeValue(
                            new Uint8Array([
                                CMD_SET_KALIBR_DATA, 
                                _index & 0xFF, 
                                tempBytes[0],      // Младший байт температуры
                                tempBytes[1],      // Старший байт температуры
                                _att_value & 0xFF, 
                                (_att_value >> 8) & 0xFF
                            ])
                        );
                        log(`Отправлена запись ${_index}: температура ${_temperature.toFixed(2)}°C -> значение ${_att_value}`, 'success');
                    }
                }
                await sleep(100); // Небольшая задержка между отправками
            } catch (error) {
                log(`Ошибка при записи строки ${i+1}: ${error.message}`, 'error');
            }
        }
    }
    log('Запись таблицы завершена', 'success');
});

// при нажатии на кнопку START
startButton.addEventListener('click', function() {
    if (!charArray || !charArray[CHARACTERISTICS.START_STOP]) {
        log('Сначала подключитесь к устройству', 'error');
        return;
    }
    
    log('Отправка команды START');
    let characteristic = charArray[CHARACTERISTICS.START_STOP].characteristic;
    let converted = new Uint8Array([0x01]);
    characteristic.writeValue(converted)
        .then(() => log('Команда START отправлена', 'success'))
        .catch(error => log('Ошибка START: ' + error, 'error'));
    
    if (modeSelectCharacteristic) {
        let converted_1 = new Uint8Array([0x02]);
        modeSelectCharacteristic.writeValue(converted_1)
            .catch(error => log('Ошибка установки режима: ' + error, 'error'));
    }
});

// при нажатии на кнопку STOP
stopButton.addEventListener('click', function() {
    if (!charArray || !charArray[CHARACTERISTICS.START_STOP]) {
        log('Сначала подключитесь к устройству', 'error');
        return;
    }
    
    log('Отправка команды STOP');
    let characteristic = charArray[CHARACTERISTICS.START_STOP].characteristic;
    let converted = new Uint8Array([0x00]);
    characteristic.writeValue(converted)
        .then(() => log('Команда STOP отправлена', 'success'))
        .catch(error => log('Ошибка STOP: ' + error, 'error'));
});

// при нажатии на кнопку CLEAR
clearButton.addEventListener('click', function() {
    terminalContainer.innerHTML = '<div>Версия V0.0.12</div>';
    tableArea.value = '';
    log('Терминал и таблица очищены');
});

// Подключение к устройству
connectButton.addEventListener('click', function() {
    connect();
});

// Отключение от устройства
disconnectButton.addEventListener('click', function() {
    disconnect();
});

// Запустить выбор Bluetooth устройства и подключиться
async function connect() {
    if (deviceCache && deviceCache.gatt.connected) {
        log('Уже подключены к устройству');
        return;
    }
    
    try {
        await requestBluetoothDevice();
        await connectToDevice();
        await discoverServicesAndCharacteristics();
        
        // Отправка установки modeSelectCharacteristic после успешного подключения
        await setModeSelectCharacteristic();
        
        log('Подключение успешно завершено', 'success');
        connectButton.disabled = true;
        disconnectButton.disabled = false;
    } catch (error) {
        log('Ошибка подключения: ' + error.message, 'error');
        console.error(error);
    }
}

// Функция для установки modeSelectCharacteristic
async function setModeSelectCharacteristic() {
    if (modeSelectCharacteristic) {
        try {
            log('Установка режима работы устройства...');
            let modeValue = new Uint8Array([0x02]);
            await modeSelectCharacteristic.writeValue(modeValue);
            log('Режим работы успешно установлен', 'success');
        } catch (error) {
            log('Ошибка установки режима: ' + error.message, 'error');
        }
    } else {
        log('Характеристика режима (MODE_SELECT) не найдена', 'warning');
    }
}

// Запрос выбора Bluetooth устройства
async function requestBluetoothDevice() {
    log('Поиск Bluetooth устройств...');

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'AB5' }
            ],
            optionalServices: [SERVICES.MAIN, SERVICES.DEBUG]
        });
        
        log('Выбрано устройство: "' + device.name + '"');
        deviceCache = device;
        deviceCache.addEventListener('gattserverdisconnected', handleDisconnection);
        return deviceCache;
    } catch (error) {
        if (error.message === 'No devices found') {
            throw new Error('Устройства не найдены');
        }
        throw error;
    }
}

// Подключение к GATT серверу
async function connectToDevice() {
    if (deviceCache.gatt.connected) {
        log('Уже подключены к GATT серверу');
        return;
    }
    
    log('Подключение к GATT серверу...');
    try {
        gattServer = await deviceCache.gatt.connect();
        log('GATT сервер подключен', 'success');
    } catch (error) {
        throw new Error('Не удалось подключиться к GATT серверу: ' + error.message);
    }
}

// Поиск всех сервисов и характеристик
async function discoverServicesAndCharacteristics() {
    if (!gattServer) {
        throw new Error('Нет подключения к GATT серверу');
    }
    
    log('Поиск доступных сервисов...');
    
    try {
        // Получаем все сервисы
        const services = await gattServer.getPrimaryServices();
        log('Найдено сервисов: ' + services.length);
        
        // Выводим информацию о найденных сервисах
        for (let service of services) {
            const uuid = service.uuid;
            log(`Сервис: ${uuid}`, 'info');
            
            // Получаем характеристики для каждого сервиса
            try {
                const characteristics = await service.getCharacteristics();
                log(`  Найдено характеристик: ${characteristics.length}`, 'info');
                
                for (let char of characteristics) {
                    log(`    Характеристика: ${char.uuid}`, 'info');
                    
                    // Сохраняем найденные характеристики
                    if (!charArray) charArray = {};
                    
                    // Проверяем, является ли эта характеристика нужной нам
                    const charUuid = char.uuid.toLowerCase();
                    
                    // AA01 (температура)
                    if (charUuid.includes('aa01') || char.uuid === CHARACTERISTICS.TEMPERATURE) {
                        charArray[CHARACTERISTICS.TEMPERATURE] = {
                            characteristic: char,
                            value: 0,
                            data: 'int32'
                        };
                        log('    -> Найдена характеристика температуры (AA01)', 'success');
                        
                        // Включаем уведомления
                        await setupNotifications(char);
                    }
                    // AA02 (START/STOP)
                    else if (charUuid.includes('aa02') || char.uuid === CHARACTERISTICS.START_STOP) {
                        charArray[CHARACTERISTICS.START_STOP] = {
                            characteristic: char,
                            value: 0,
                            data: 'uint8'
                        };
                        log('    -> Найдена характеристика управления (AA02)', 'success');
                    }
                    // AA65 (режим)
                    else if (charUuid.includes('aa65') || char.uuid === CHARACTERISTICS.MODE_SELECT) {
                        modeSelectCharacteristic = char;
                        log('    -> Найдена характеристика режима (AA65)', 'success');
                    }
                    // Debug Pipe
                    else if (char.uuid === CHARACTERISTICS.DEBUG_PIPE) {
                        debugPipeInOutCharacteristic = char;
                        debugPipeInOutCharacteristic.addEventListener('characteristicvaluechanged', debugPipeInValueChanged);
                        log('    -> Найдена Debug Pipe характеристика', 'success');
                        
                        // Пытаемся включить уведомления для Debug Pipe
                        try {
                            await debugPipeInOutCharacteristic.startNotifications();
                            log('    -> Уведомления Debug Pipe включены', 'success');
                        } catch (e) {
                            log('    -> Не удалось включить уведомления Debug Pipe: ' + e.message, 'warning');
                        }
                    }
                }
            } catch (error) {
                log(`  Ошибка при получении характеристик для сервиса ${uuid}: ${error.message}`, 'warning');
            }
        }
        
        // Проверяем, нашли ли мы необходимые характеристики
        if (!charArray[CHARACTERISTICS.TEMPERATURE]) {
            log('ВНИМАНИЕ: Характеристика температуры (AA01) не найдена', 'warning');
        }
        if (!charArray[CHARACTERISTICS.START_STOP]) {
            log('ВНИМАНИЕ: Характеристика управления (AA02) не найдена', 'warning');
        }
        
    } catch (error) {
        throw new Error('Ошибка при поиске сервисов: ' + error.message);
    }
}

// Настройка уведомлений для характеристики
async function setupNotifications(characteristic) {
    log('Настройка уведомлений для ' + characteristic.uuid + '...');
    try {
        await characteristic.startNotifications();
        log('Уведомления включены', 'success');
        characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
    } catch (error) {
        log('Не удалось включить уведомления: ' + error.message, 'warning');
    }
}

// Обработчик разъединения
function handleDisconnection(event) {
    let device = event.target;
    log('"' + device.name + '" отключен', 'warning');
    
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    temperatureLabel.innerHTML = '...';
    
    // Очищаем кэш
    charArray = null;
    gattServer = null;
    modeSelectCharacteristic = null;
    debugPipeInOutCharacteristic = null;
    
    // Пытаемся переподключиться
    log('Попытка переподключения...');
    setTimeout(() => {
        if (!deviceCache.gatt.connected) {
            connect();
        }
    }, 2000);
}

// Функция для преобразования байтов в int32 с big endian
function bytesToInt32BigEndian(bytes) {
    return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
}

// Функция для преобразования байтов в int16 с big endian
function bytesToInt16BigEndian(bytes) {
    return (bytes[0] << 8) | bytes[1];
}

// Получение данных от характеристики (BIG ENDIAN)
function handleCharacteristicValueChanged(event) {
    try {
        let value = event.target.value;
        let bytes = new Uint8Array(value.buffer);
        
        let temperature;
        
        if (bytes.length >= 4) {
            // Читаем как int32 big endian
            temperature = bytesToInt32BigEndian(bytes) / 100;
            log(`Температура: ${temperature.toFixed(2)} °C`, 'in');
            temperatureLabel.innerHTML = temperature.toFixed(2);
        } else if (bytes.length === 2) {
            // Читаем как int16 big endian
            temperature = bytesToInt16BigEndian(bytes) / 100;
            log(`Температура (int16 BE): ${temperature.toFixed(2)} °C`, 'in');
            temperatureLabel.innerHTML = temperature.toFixed(2);
        } else if (bytes.length === 1) {
            // Если 1 байт
            temperature = bytes[0];
            log(`Температура (uint8): ${temperature} °C`, 'in');
            temperatureLabel.innerHTML = temperature;
        } else {
            log(`Неизвестный формат данных (${bytes.length} байт)`, 'warning');
        }
        
    } catch (error) {
        log('Ошибка чтения данных: ' + error.message, 'error');
        console.error(error);
    }
}

// Обработчик Debug Pipe (расширен для поддержки калибровки)
function debugPipeInValueChanged(event) {
    try {
        let value = event.target.value;
        let bytes = new Uint8Array(value.buffer);
        
        // Выводим сырые данные для отладки
        let hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        log(`Debug Pipe (${bytes.length} байт): ${hexString}`, 'debug');
        
        // Проверяем, являются ли данные калибровочными
        if (bytes.length >= 1 && bytes[0] === COMM_TYPE_KALIBR_DATA) {
            log('Получены калибровочные данные', 'info');
            
            if (bytes.length >= 4) {
                // Приём таблицы коэффициентов
                if (bytes[1] === 0xFF) {
                    // Количество записей
                    let count = (bytes[3] << 8) + bytes[2];
                    tableArea.value += count + '\r\n';
                    log(`Количество записей в таблице: ${count}`, 'success');
                } else {
                    // Данные записи: индекс, температура, значение
                    let index = bytes[1];
                    // Читаем температуру как int16 (little endian)
                    let tempRaw = bytesToInt16(bytes, 2);
                    let temperature = tempRaw / 1.0; // Делаем обратное преобразование
                    let attValue = (bytes[5] << 8) + bytes[4];
                    tableArea.value += index + ',\t' + temperature.toFixed(2) + ',\t' + attValue + '\r\n';
                    log(`Запись ${index}: температура ${temperature.toFixed(2)}°C, значение ${attValue}`, 'info');
                }
            }
            return; // Не пытаемся декодировать как текст
        }
        
        // Пробуем декодировать как текст (для обычных debug сообщений)
        try {
            let text = new TextDecoder('utf-8').decode(bytes);
            if (text.trim()) {
                log(`Debug: ${text}`, 'debug');
            }
        } catch (e) {
            // Игнорируем ошибки декодирования
        }
        
    } catch (error) {
        log('Ошибка Debug Pipe: ' + error.message, 'error');
    }
}

// Отключиться от устройства
function disconnect() {
    if (deviceCache) {
        log('Отключение от "' + deviceCache.name + '"...');
        deviceCache.removeEventListener('gattserverdisconnected', handleDisconnection);
        
        if (deviceCache.gatt.connected) {
            deviceCache.gatt.disconnect();
            log('Отключено', 'success');
        }
        
        // Очищаем кэш
        charArray = null;
        gattServer = null;
        modeSelectCharacteristic = null;
        debugPipeInOutCharacteristic = null;
        deviceCache = null;
        
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        temperatureLabel.innerHTML = '...';
        tableArea.value = '';
    }
}

// Вывод в терминал
function log(data, type = '') {
    let color = '';
    switch(type) {
        case 'error':
            color = '#f44336';
            break;
        case 'warning':
            color = '#ff9800';
            break;
        case 'success':
            color = '#4caf50';
            break;
        case 'in':
            color = '#000000';
            break;
        case 'debug':
            color = '#9c27b0';
            break;
        case 'info':
            color = '#607d8b';
            break;
        default:
            color = '#000000';
    }
    
    const timestamp = new Date().toLocaleTimeString();
    terminalContainer.insertAdjacentHTML('beforeEnd',
        `<div style="color: ${color}; margin: 2px 0; font-family: monospace;">
            [${timestamp}] ${data}
        </div>`);
    
    // Автоматическая прокрутка вниз
    requestAnimationFrame(() => {
        terminalContainer.scrollTop = terminalContainer.scrollHeight;
    });
}