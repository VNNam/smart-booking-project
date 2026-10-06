/**
 * ==============================================================================
 * DỰ ÁN: SMART MEETING ROOM BOOKING SYSTEM
 * MODULE: Mobile App - Room Search & Availability Filter Screen
 * FILE: frontend/mobile/src/screens/RoomSearchScreen.tsx
 * MÔ TẢ: Màn hình tra cứu và lọc phòng họp theo thời gian thực (React Native/TypeScript)
 *       Hỗ trợ lọc theo tiện ích (Máy chiếu, Bảng trắng, Video Conf), sức chứa,
 *       và hiển thị trực quan trạng thái phòng (AVAILABLE, LOCKED_PENDING_ONLINE, BOOKED).
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView
} from 'react-native';

export interface RoomItem {
    id: string;
    name: string;
    branchName: string;
    roomType: 'STANDARD' | 'EXECUTIVE' | 'BOARDROOM';
    capacity: number;
    hourlyRate: number;
    amenities: {
        projector: boolean;
        whiteboard: boolean;
        videoConf: boolean;
    };
    currentStatus: 'AVAILABLE' | 'LOCKED_PENDING_ONLINE' | 'BOOKED';
    lockRemainingSeconds?: number;
}

interface RoomSearchScreenProps {
    navigation: {
        navigate: (screen: string, params?: any) => void;
    };
}

const MOCK_ROOMS: RoomItem[] = [
    {
        id: 'r-01',
        name: 'Meeting Room Alpha',
        branchName: 'Chi nhánh Quận 1 (Tầng 12)',
        roomType: 'STANDARD',
        capacity: 8,
        hourlyRate: 350000,
        amenities: { projector: true, whiteboard: true, videoConf: false },
        currentStatus: 'AVAILABLE'
    },
    {
        id: 'r-02',
        name: 'Executive Boardroom Tokyo',
        branchName: 'Chi nhánh Cầu Giấy (Tầng 8)',
        roomType: 'EXECUTIVE',
        capacity: 16,
        hourlyRate: 650000,
        amenities: { projector: true, whiteboard: true, videoConf: true },
        currentStatus: 'LOCKED_PENDING_ONLINE',
        lockRemainingSeconds: 480 // 8 phút còn lại
    },
    {
        id: 'r-03',
        name: 'Grand Boardroom New York',
        branchName: 'Chi nhánh Quận 1 (Tầng 15)',
        roomType: 'BOARDROOM',
        capacity: 25,
        hourlyRate: 1200000,
        amenities: { projector: true, whiteboard: true, videoConf: true },
        currentStatus: 'BOOKED'
    }
];

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export default function RoomSearchScreen({ navigation }: RoomSearchScreenProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCapacity, setSelectedCapacity] = useState<number | null>(null);
    const [filterProjector, setFilterProjector] = useState(false);
    const [filterVideoConf, setFilterVideoConf] = useState(false);

    const filteredRooms = useMemo(() => {
        return MOCK_ROOMS.filter((room) => {
            const matchesQuery =
                room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                room.branchName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCapacity = selectedCapacity ? room.capacity >= selectedCapacity : true;
            const matchesProjector = filterProjector ? room.amenities.projector : true;
            const matchesVideoConf = filterVideoConf ? room.amenities.videoConf : true;

            return matchesQuery && matchesCapacity && matchesProjector && matchesVideoConf;
        });
    }, [searchQuery, selectedCapacity, filterProjector, filterVideoConf]);

    const renderRoomCard = ({ item }: { item: RoomItem }) => {
        const isAvailable = item.currentStatus === 'AVAILABLE';
        const isLocked = item.currentStatus === 'LOCKED_PENDING_ONLINE';

        return (
            <TouchableOpacity
                testID={`room-card-${item.id}`}
                activeOpacity={isAvailable ? 0.8 : 0.95}
                disabled={!isAvailable}
                onPress={() => navigation.navigate('RoomDetail', { room: item })}
                style={[
                    styles.cardContainer,
                    !isAvailable && styles.cardDisabled
                ]}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.headerTitleGroup}>
                        <Text style={styles.roomName}>{item.name}</Text>
                        <Text style={styles.branchName}>{item.branchName}</Text>
                    </View>
                    <View style={styles.badgeContainer}>
                        {isAvailable && (
                            <View style={[styles.badge, styles.badgeAvailable]}>
                                <Text style={styles.badgeTextAvailable}>● Còn trống</Text>
                            </View>
                        )}
                        {isLocked && (
                            <View style={[styles.badge, styles.badgeLocked]}>
                                <Text style={styles.badgeTextLocked}>⏳ Giữ chỗ (8p)</Text>
                            </View>
                        )}
                        {item.currentStatus === 'BOOKED' && (
                            <View style={[styles.badge, styles.badgeBooked]}>
                                <Text style={styles.badgeTextBooked}>✕ Đã đặt</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Amenities & Sức chứa */}
                <View style={styles.amenitiesRow}>
                    <Text style={styles.amenityTag}>👥 {item.capacity} chỗ</Text>
                    {item.amenities.projector && <Text style={styles.amenityTag}>📽️ Máy chiếu</Text>}
                    {item.amenities.videoConf && <Text style={styles.amenityTag}>📹 Video Conf</Text>}
                </View>

                {/* Footer Giá & Hành động */}
                <View style={styles.cardFooter}>
                    <Text style={styles.priceLabel}>
                        <Text style={styles.priceValue}>{formatVND(item.hourlyRate)}</Text> / giờ
                    </Text>
                    <TouchableOpacity
                        style={[styles.btnBook, !isAvailable && styles.btnBookDisabled]}
                        disabled={!isAvailable}
                        onPress={() => navigation.navigate('RoomDetail', { room: item })}
                    >
                        <Text style={styles.btnBookText}>
                            {isAvailable ? 'Chọn Phòng →' : 'Không Khả Dụng'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#020617" />
            <View style={styles.container}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Text style={styles.headerTitle}>Tìm Phòng Họp Thông Minh</Text>
                    <TextInput
                        testID="search-input"
                        placeholder="Tìm theo tên phòng, địa điểm tòa nhà..."
                        placeholderTextColor="#64748b"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={styles.searchInput}
                    />
                </View>

                {/* Quick Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    <TouchableOpacity
                        onPress={() => setSelectedCapacity(selectedCapacity === 8 ? null : 8)}
                        style={[styles.filterChip, selectedCapacity === 8 && styles.filterChipActive]}
                    >
                        <Text style={[styles.filterChipText, selectedCapacity === 8 && styles.filterChipTextActive]}>
                            ≥ 8 người
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setSelectedCapacity(selectedCapacity === 16 ? null : 16)}
                        style={[styles.filterChip, selectedCapacity === 16 && styles.filterChipActive]}
                    >
                        <Text style={[styles.filterChipText, selectedCapacity === 16 && styles.filterChipTextActive]}>
                            ≥ 16 người
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterProjector(!filterProjector)}
                        style={[styles.filterChip, filterProjector && styles.filterChipActive]}
                    >
                        <Text style={[styles.filterChipText, filterProjector && styles.filterChipTextActive]}>
                            📽️ Máy chiếu
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setFilterVideoConf(!filterVideoConf)}
                        style={[styles.filterChip, filterVideoConf && styles.filterChipActive]}
                    >
                        <Text style={[styles.filterChipText, filterVideoConf && styles.filterChipTextActive]}>
                            📹 Video Conf
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Room List */}
                <FlatList
                    data={filteredRooms}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRoomCard}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617'
    },
    container: {
        flex: 1,
        backgroundColor: '#020617',
        paddingHorizontal: 16
    },
    searchContainer: {
        paddingTop: 12,
        paddingBottom: 8
    },
    headerTitle: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12
    },
    searchInput: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#f8fafc',
        fontSize: 14
    },
    filterScroll: {
        maxHeight: 46,
        marginVertical: 10
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        marginRight: 8,
        justifyContent: 'center'
    },
    filterChipActive: {
        backgroundColor: '#059669',
        borderColor: '#10b981'
    },
    filterChipText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600'
    },
    filterChipTextActive: {
        color: '#ffffff'
    },
    listContent: {
        paddingBottom: 24,
        paddingTop: 4
    },
    cardContainer: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14
    },
    cardDisabled: {
        opacity: 0.6
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10
    },
    headerTitleGroup: {
        flex: 1,
        paddingRight: 8
    },
    roomName: {
        color: '#f8fafc',
        fontSize: 16,
        fontWeight: 'bold'
    },
    branchName: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 2
    },
    badgeContainer: {
        alignItems: 'flex-end'
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeAvailable: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: '#10b981'
    },
    badgeTextAvailable: {
        color: '#34d399',
        fontSize: 11,
        fontWeight: 'bold'
    },
    badgeLocked: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        borderWidth: 1,
        borderColor: '#f59e0b'
    },
    badgeTextLocked: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: 'bold'
    },
    badgeBooked: {
        backgroundColor: '#1e293b'
    },
    badgeTextBooked: {
        color: '#64748b',
        fontSize: 11
    },
    amenitiesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14
    },
    amenityTag: {
        color: '#cbd5e1',
        fontSize: 11,
        backgroundColor: '#1e293b',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        paddingTop: 12
    },
    priceLabel: {
        color: '#94a3b8',
        fontSize: 12
    },
    priceValue: {
        color: '#10b981',
        fontSize: 16,
        fontWeight: 'bold'
    },
    btnBook: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10
    },
    btnBookDisabled: {
        backgroundColor: '#334155'
    },
    btnBookText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold'
    }
});
