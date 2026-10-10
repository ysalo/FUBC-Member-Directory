export type AddressFields = {
    street: string;
    unit: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
};
export const emptyAddressFields = (): AddressFields => ({ street: "", unit: "", city: "", region: "", postalCode: "", country: "" });

/** Keep unfamiliar legacy text intact rather than guessing and losing address parts. */
export function parseAddressFields(address: string): AddressFields {
    const fields = emptyAddressFields();
    const lines = address.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return fields;
    const localityPattern = /^([^,]+?),\s*([\p{L} .'-]+?)(?:\s+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d))?$/iu;
    const postalLocalityPattern = /^([^,]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)$/iu;
    const matchLocality = (line: string) => line.match(localityPattern) ?? line.match(postalLocalityPattern);
    // The new form writes a separate locality line; also recognize common one-line imports.
    if (lines.length === 1) {
        const standaloneLocality = matchLocality(lines[0]);
        if (standaloneLocality && /^[A-Z]{2}$/iu.test(standaloneLocality[2])) {
            fields.city = standaloneLocality[1]; fields.region = standaloneLocality[2]; fields.postalCode = standaloneLocality[3] ?? "";
            return fields;
        }
        const parts = lines[0].split(/,\s*/);
        const tailLocality = parts.length >= 2 ? parts.at(-1)!.match(postalLocalityPattern) : null;
        const locality = tailLocality ?? (parts.length >= 3 ? matchLocality(`${parts.at(-2)}, ${parts.at(-1)}`) : null);
        if (locality) {
            fields.street = parts[0];
            fields.unit = parts.slice(1, tailLocality ? -1 : -2).join(", ");
            fields.city = locality[1]; fields.region = locality[2]; fields.postalCode = locality[3] ?? "";
            return fields;
        }
        fields.street = address;
        return fields;
    }
    let index = lines.length - 1;
    let locality = matchLocality(lines[index]);
    if (!locality && index > 1) {
        locality = matchLocality(lines[index - 1]);
        if (locality) { fields.country = lines[index]; index--; }
    }
    if (!locality) { fields.street = address; return fields; }
    fields.street = lines[0];
    fields.unit = lines.slice(1, index).join("\n");
    fields.city = locality[1]; fields.region = locality[2]; fields.postalCode = locality[3] ?? "";
    return fields;
}

export function formatAddressFields(fields: AddressFields): string {
    const regionPostal = [fields.region.trim(), fields.postalCode.trim()].filter(Boolean).join(" ");
    const locality = [fields.city.trim(), regionPostal].filter(Boolean).join(", ");
    return [fields.street.trim(), fields.unit.trim(), locality, fields.country.trim()].filter(Boolean).join("\n");
}
