// Получение ссылок на элементы UI
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let terminalContainer = document.getElementById('terminal');
let startButton = document.getElementById('startBtn');
let stopButton = document.getElementById('stopBtn');
let clearButton = document.getElementById('clrBtn');
let temperatureLabel = document.getElementById('temperature');

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
    terminalContainer.innerHTML = '<div>Версия V0.0.11</div>';
    log('Терминал очищен');
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
        log('Подключение успешно завершено', 'success');
        connectButton.disabled = true;
        disconnectButton.disabled = false;
    } catch (error) {
        log('Ошибка подключения: ' + error.message, 'error');
        console.error(error);
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
        
        // Выводим сырые данные для отладки
        //let hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        //log(`Получены данные (${bytes.length} байт): ${hexString}`, 'debug');
        
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
            // Пробуем интерпретировать как float
            if (bytes.length === 4) {
                let view = new DataView(value.buffer);
                let floatValue = view.getFloat32(0, false); // false = big endian
                log(`Как float32 BE: ${floatValue}`, 'debug');
            }
        }
        
    } catch (error) {
        log('Ошибка чтения данных: ' + error.message, 'error');
        console.error(error);
    }
}

// Обработчик Debug Pipe
function debugPipeInValueChanged(event) {
    try {
        let value = event.target.value;
        let bytes = new Uint8Array(value.buffer);
        
        // Выводим сырые данные
        let hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        log(`Debug Pipe (${bytes.length} байт): ${hexString}`, 'debug');
        
        // Пробуем декодировать как текст
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