import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { id } = req.query;

    if (req.method === 'PATCH') {
        const { isMaintenance, reason } = req.body;
        return res.status(200).json({
            success: true,
            roomId: id,
            isMaintenance,
            reason: reason || 'Bảo trì định kỳ',
            message: isMaintenance
                ? `Đã tạm ngưng bảo trì phòng ${id} và chuyển các slot trống sang MAINTENANCE.`
                : `Đã mở lại phòng ${id} và kích hoạt các slot về AVAILABLE.`
        });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

