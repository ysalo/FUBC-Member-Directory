import { View, StyleSheet } from "react-native";

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.container}>
            {Array.from({ length: rows }, (_, index) => (
                <View key={index} style={styles.row}>
                    <View style={styles.avatar} />
                    <View style={styles.copy}>
                        <View style={styles.title} />
                        <View style={styles.detail} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 10, paddingVertical: 12 },
    row: { alignItems: "center", backgroundColor: "rgba(127, 127, 127, 0.10)", borderRadius: 14, flexDirection: "row", gap: 12, minHeight: 72, padding: 12 },
    avatar: { backgroundColor: "rgba(127, 127, 127, 0.18)", borderRadius: 24, height: 48, width: 48 },
    copy: { flex: 1, gap: 9 },
    title: { backgroundColor: "rgba(127, 127, 127, 0.18)", borderRadius: 4, height: 14, maxWidth: 190, width: "70%" },
    detail: { backgroundColor: "rgba(127, 127, 127, 0.14)", borderRadius: 4, height: 11, maxWidth: 260, width: "90%" },
});
