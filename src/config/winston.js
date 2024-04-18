import { createLogger, format, transports } from "winston";
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const customLevelOption = {
    levels: {
        fatal: 0,
        error: 1,
        warning: 2,
        success: 3,
        info: 4,
        debug: 5
    },
    colors: {
        fatal: 'red',
        error: 'red',
        warning: 'yellow',
        success: 'green',
        info: 'blue',
        debug: 'white'
    }
};

const logsDir = path.resolve(__dirname, "../../logs");

const logger = createLogger({
    levels: customLevelOption.levels,
    transports: [
        new transports.Console({
            level: 'debug',
            format: format.combine(
                format.colorize({colors: customLevelOption.colors}),
                format.simple()
            )
        }),
        new transports.File({
            filename: path.join(logsDir, `errors.log`), 
            level: 'warning',
            format: format.combine(
                format.timestamp(),
                format.printf(info => {
                    return `[${info.timestamp}] [${info.level.toUpperCase()}] - ${info.message}`;
                })
            )
        }),
        new transports.File({
            filename: path.join(logsDir, `console.log`),
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.printf(info => {
                    return `[${info.timestamp}] [${info.level.toUpperCase()}] - ${info.message}`;
                })
            )
        })
    ]
});

export default logger;
