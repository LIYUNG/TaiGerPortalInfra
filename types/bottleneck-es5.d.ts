/**
 * `bottleneck` ships typings for its main entry point only. The Lambda mailer
 * imports the pre-transpiled `bottleneck/es5` build, which is the same API, so
 * re-point it at the published declarations.
 */
declare module "bottleneck/es5" {
    import Bottleneck from "bottleneck";
    export default Bottleneck;
}
