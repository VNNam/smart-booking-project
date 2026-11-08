import type { NextApiRequest, NextApiResponse } from 'next';

// Dữ liệu mẫu khởi tạo đồng bộ
const mockRooms = [
    {
        id: 'r0000000-0000-0000-0000-000000000001',
        name: 'Meeting Room Alpha',
        roomType: 'STANDARD',
        capacity: 8,
        hourlyRate: 350000,
        amenities: { projector: true, whiteboard: true, highSpeedWifi: true },
        isActive: true
    },
    {
        id: 'r0000000-0000-0000-0000-000000000002',
        name: 'Executive Boardroom Tokyo',
        roomType: 'EXECUTIVE',
        capacity: 16,
        hourlyRate: 650000,
        amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, highSpeedWifi: true },
        isActive: true
    },
    {
        id: 'r0000000-0000-0000-0000-000000000003',
        name: 'Boardroom New York',
        roomType: 'BOARDROOM',
        capacity: 24,
        hourlyRate: 1200000,
        amenities: { projector: true, whiteboard: true, videoConf: true, soundSystem: true, smartTv: true, highSpeedWifi: true },
        isActive: false
    }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        return res.status(200).json({ success: true, data: mockRooms });
    }

    if (req.method === 'POST') {
        const newRoom = {
            id: `r-${Date.now()}`,
            ...req.body,
            isActive: true
        };
        mockRooms.push(newRoom);
        return res.status(201).json({ success: true, data: newRoom });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

