import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks"
import * as pulumi from "@pulumi/pulumi"
import {RdsDatabase} from "./rds"

const name = pulumi.getProject();
const tags = { "Project": "3-tier-webapp", "Owner": "pulumi"};

// Createa a VPC with public & private subnets across all AZs.
const vpc = new awsx.ec2.Vpc(name,
    {
        cidrBlock: "172.16.0.0/16",
        numberOfAvailabilityZones: "all",
        tags: { "Name": name, ...tags },
    },
    /*
    {
        transformations: [(args) => {
            if (args.type === "aws:ec2/vpc:Vpc" || args.type === "aws:ec2/subnet:Subnet") {
                return {
                    props: args.props,
                    opts: pulumi.mergeOptions(args.opts, { ignoreChanges: ["tags"] })
                }
            }
            return undefined;
        }],
    },
    */
);

// Create an EKS cluster with the default VPC, and default node group with 
// two t2.medium node instances.
const cluster = new eks.Cluster("eks", {
    vpcId: vpc.id,
    publicSubnetIds: vpc.publicSubnetIds,
    privateSubnetIds: vpc.privateSubnetIds,
    deployDashboard: false,
    nodeAssociatePublicIpAddress: false,
    tags,
});

export const kubeconfig = cluster.kubeconfig;

// Deploy RDS Aurora DB
const rds = new RdsDatabase("rds-db", {
    privateSubnetIds: vpc.privateSubnetIds,
    securityGroupId : cluster.nodeSecurityGroup.id,
    replicas: 2,
    instanceClass: "db.r4.large",
    tags,
});
const db = rds.db;

// Export the DB connection information.
interface DbConn {
    host: pulumi.Input<string>;
    port: pulumi.Input<string>;
    username: pulumi.Input<string>;
    password: pulumi.Input<string>;
    database: pulumi.Input<string>;
}
export const dbConn: DbConn = {
    host: db.endpoint,
    port: db.port.apply(port => port.toString()),
    username: db.masterUsername,
    password: rds.password, // db.masterPassword can possibly be undefined. Use rds.password instead.
    database: "test",
};
