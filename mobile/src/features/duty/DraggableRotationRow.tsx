import { useRef, useState, type ReactNode, type RefObject } from "react";
import { PanResponder, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useAppearance } from "@/features/appearance/AppearanceProvider";

export type RotationLayout = { y: number; height: number };
type Props = {
  id: string;
  ids: string[];
  disabled: boolean;
  label: string;
  layouts: RefObject<Map<string, RotationLayout>>;
  onDrag: (targetId: string | null) => void;
  onDrop: (targetId: string) => void;
  children: (handle: ReactNode) => ReactNode;
};

/** Drag only from the handle, leaving checkbox, arrow buttons and list scrolling independent. */
export function DraggableRotationRow(props: Props) {
  const { palette } = useAppearance();
  const latest = useRef(props);
  latest.current = props;
  const drag = useRef<{ center: number; ids: string[]; target: string; dy: number; layouts: Map<string, RotationLayout> } | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const finish = (commit: boolean) => {
    const current = drag.current;
    drag.current = null;
    setOffset(null);
    latest.current.onDrag(null);
    if (commit && current && Math.abs(current.dy) >= 6 && !latest.current.disabled && current.ids.join() === latest.current.ids.join()) latest.current.onDrop(current.target);
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled && latest.current.ids.length > 1,
    onPanResponderGrant: () => {
      const { id, ids, layouts } = latest.current;
      const layout = layouts.current.get(id);
      if (!layout) return;
      drag.current = { center: layout.y + layout.height / 2, ids: [...ids], target: id, dy: 0, layouts: new Map(layouts.current) };
      setOffset(0);
      latest.current.onDrag(id);
    },
    onPanResponderMove: (_, gesture) => {
      const current = drag.current;
      if (!current) return;
      const centers = current.ids.flatMap(id => {
        const layout = current.layouts.get(id);
        return layout ? [{ id, center: layout.y + layout.height / 2 }] : [];
      });
      if (!centers.length) return;
      const y = Math.max(centers[0].center, Math.min(centers[centers.length - 1].center, current.center + gesture.dy));
      const target = centers.reduce((nearest, row) => Math.abs(row.center - y) < Math.abs(nearest.center - y) ? row : nearest);
      current.dy = y - current.center;
      setOffset(current.dy);
      if (current.target !== target.id) { current.target = target.id; latest.current.onDrag(target.id); }
    },
    onPanResponderRelease: () => finish(true),
    onPanResponderTerminate: () => finish(false),
    onPanResponderTerminationRequest: () => false,
  })).current;
  const webHandleStyle: ViewStyle & { touchAction?: string } = { touchAction: "none", cursor: props.disabled ? "auto" : "pointer" };
  const handle = <View {...responder.panHandlers} accessibilityLabel={props.label} style={[styles.handle, Platform.OS === "web" && webHandleStyle, props.disabled && { opacity: 0.3 }]}>
    <Ionicons aria-hidden accessibilityElementsHidden importantForAccessibility="no" name="reorder-three-outline" size={24} color={palette.secondaryText} />
  </View>;
  return <View onLayout={event => props.layouts.current.set(props.id, event.nativeEvent.layout)} style={offset === null ? undefined : { zIndex: 10, elevation: 6, transform: [{ translateY: offset }], opacity: 0.95 }}>
    {props.children(handle)}
  </View>;
}
const styles = StyleSheet.create({ handle: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 } });
