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
    // The new form writes a separate locality line; also recognize common one-line imports.
    if (lines.length === 1) {
        const standaloneLocality = lines[0].match(localityPattern);
        if (standaloneLocality && (/^[A-Z]{2}$/u.test(standaloneLocality[2]) || standaloneLocality[3])) {
            fields.city = standaloneLocality[1]; fields.region = standaloneLocality[2]; fields.postalCode = standaloneLocality[3] ?? "";
            return fields;
        }
        const parts = lines[0].split(/,\s*/);
        const locality = parts.length >= 3 ? `${parts.at(-2)}, ${parts.at(-1)}`.match(localityPattern) : null;
        if (locality) {
            fields.street = parts[0];
            fields.unit = parts.slice(1, -2).join(", ");
            fields.city = locality[1]; fields.region = locality[2]; fields.postalCode = locality[3] ?? "";
            return fields;
        }
        fields.street = address;
        return fields;
    }
    let index = lines.length - 1;
    let locality = lines[index].match(localityPattern);
    if (!locality && index > 1) {
        locality = lines[index - 1].match(localityPattern);
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
