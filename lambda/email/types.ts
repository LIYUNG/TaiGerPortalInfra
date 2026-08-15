/** Everything the mailer needs to address a single person. */
export interface Recipient {
    firstname?: string;
    lastname?: string;
    address: string;
}
