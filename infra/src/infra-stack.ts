import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { IpAddresses } from 'aws-cdk-lib/aws-ec2';
import * as keypair from 'cdk-ec2-key-pair'; 
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as route53 from 'aws-cdk-lib/aws-route53';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const instance = this.createEc2Instance();
    this.createDDB();

    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: 'ask-frank.shop' });
    
    new route53.ARecord(this, 'ServerRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromIpAddresses(instance.instancePublicIp)
    });
  }

  private createEc2Instance() {
    const vpc = new ec2.Vpc(this, 'HomeBody', {
      ipAddresses: IpAddresses.cidr('10.0.0.0/24')
    });

    const key = new keypair.KeyPair(this, 'KeyPair', {
      name: 'homebody-keypair',
      description: 'Key Pair created with CDK Deployment',
    });
    key.grantReadOnPublicKey; 

    const securityGroup = new ec2.SecurityGroup(this, 'WebDMZ', {
      vpc,
      description: 'Allow Http, Https, and SSH',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH Access'
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP Access'
    );

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS Access'
    );

    const role = new iam.Role(this, 'ec2Role',{
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });

    return new ec2.Instance(this, 'WebServer', {
      machineImage: new ec2.LookupMachineImage({
        name: 'Ubuntu Server 22.04 LTS'
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      vpc: vpc,
      securityGroup: securityGroup,
      keyName: key.keyPairName,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });
  }

  private createDDB() {
    const appliances = new ddb.Table(this, 'Appliances', {
      tableName: 'appliances',
      partitionKey: {
        name: 'Id',
        type: ddb.AttributeType.STRING
      }
    });
  }
}
