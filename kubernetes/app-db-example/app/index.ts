import * as k8s from "@pulumi/kubernetes";
import * as app from "./app";
import {config} from "./config";

// Create a k8s provider for the remote GKE cluster.
const provider = new k8s.Provider("gkeProvider", {
    kubeconfig: config.kubeconfig,
    namespace: config.appsNamespaceName,
});

// Create the application on the cluster.
const instance = new app.DemoApp("demo", {
    provider,
    imageName: "metral/flask-postgres:v0.0.1",
});
export const instanceUrl = instance.url;
