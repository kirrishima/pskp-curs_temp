export function translateStatus(status: string) {
    switch (status) {
        case "CONFIRMED":
            return "ПОДТВЕРЖДЕНО";
        case "PENDING":
            return "ОЖИДАЕТСЯ";
        case "CANCELLED":
            return "ОТМЕНЕНО";
        case "CHECKED_IN":
            return "ЗАСЕЛЕН";
        case "CHECKED_OUT":
            return "ВЫЕХАЛ";
        default:
            return status;
    }
};

export function getStatusColor(status: string) {
    switch (status) {
        case "CONFIRMED":
            return "bg-green-100 text-green-800";
        case "PENDING":
            return "bg-yellow-100 text-yellow-800";
        case "CANCELLED":
            return "bg-red-100 text-red-800";
        case "CHECKED_IN":
            return "bg-blue-100 text-blue-800";
        case "CHECKED_OUT":
            return "bg-gray-100 text-gray-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
};

export function translateCleaningStatus(status: string) {
    switch (status) {
        case "SCHEDULED":
            return "ЗАПЛАНИРОВАНО";
        case "DONE":
            return "ВЫПОЛНЕНО";
        case "CANCELLED":
            return "ОТМЕНЕНО";
        default:
            return status;
    }
}

export function getCleaningStatusColor(status: string) {
    switch (status) {
        case "SCHEDULED":
            return "bg-blue-100 text-blue-800";
        case "DONE":
            return "bg-green-100 text-green-800";
        case "CANCELLED":
            return "bg-red-100 text-red-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
}
