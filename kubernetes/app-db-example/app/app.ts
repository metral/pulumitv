import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";
import {config} from "./config";
import { types } from "@pulumi/kubernetesx";
import EnvMap = types.EnvMap;

export interface DemoAppArgs {
    provider: k8s.Provider,
    imageName: pulumi.Input<string>,
}

export class DemoApp extends pulumi.ComponentResource {
    public readonly imageName: pulumi.Output<string>;
    public readonly persistentVolumeClaim: kx.PersistentVolumeClaim;
    public readonly configMap: kx.ConfigMap;
    public readonly secret: kx.Secret;
    public readonly deployment: kx.Deployment;
    public readonly service: kx.Service;
    public readonly endpoint: pulumi.Output<string>;
    public readonly url: pulumi.Output<string>;
    constructor(name: string,
        args: DemoAppArgs,
        opts: pulumi.ComponentResourceOptions = {}) {
        super("demo-app", name, args, opts);

        // Create a Secret from the DB connection information.
        const dbConnSecret = new kx.Secret("aurora-db-conn",
            {
                metadata: { namespace: config.appsNamespaceName },
                stringData: {
                    host: config.dbConn.apply(db => db.host),
                    endpoint: config.dbConn.apply(db => `${db.host}:${db.port}`),
                    username: config.dbConn.apply(db => db.username),
                    password: config.dbConn.apply(db => db.password),
                },
            },
            {provider: args.provider},
        );

        const dbConnString = pulumi.output(dbConnSecret).apply(secret => {
            const host = secret.stringData["host"];
            const port = secret.stringData["port"];
            const user = secret.stringData["username"];
            const pass = secret.stringData["password"];
            const db = "test";
            return `postgresql+psycopg2://${user}:${pass}@${host}:${port}/${db}`
        });

        // Define the PodBuilder for the Deployment.
        const pb = new kx.PodBuilder({
            containers: [{
                env: [{
                    name: "SQLALCHEMY_DATABASE_URI",
                    value: dbConnString,
                }],
                image: args.imageName,
                resources: {requests: {cpu: "128m", memory: "128Mi"}},
                ports: { "http": 5000 },
            }],
        });

        // Create a Deployment.
        this.deployment = new kx.Deployment("app-kx", {
            spec: pb.asDeploymentSpec({replicas: 2}),
        }, { provider: args.provider });

        // Create a Service.
        this.service = this.deployment.createService({
            type: kx.types.ServiceType.LoadBalancer
        });
        this.url = pulumi.interpolate`http://${this.service.endpoint}`;
    }
}
