---
title: "Blog"
date: 2018-08-06T14:07:07.818Z
author: François Donzé 
tags: ["Redfish","PostState","PowerState","ServerState","iLO5","ProLiant","Synergy"]
path: master-the-redfish-server-states-to-improve-your-monitoring-and-manageme
---
## Introduction

Server management and monitoring often require the knowledge of the state of the managed servers (On, Off....). The [Redfish&reg;](https://www.dmtf.org/standards/redfish) standard defines the [`PowerState`](https://redfish.dmtf.org/schemas/v1/ComputerSystem.v1_5_0.json) property with 0 (`Off`) and 1 (`On`) as possible values. However, when the system is in the `On` state, we'd like to know in which sub-state the server is: Pre-OS Tasks (POST), UEFI, OS...

This blog presents the [`PostState`](https://hewlettpackard.github.io/ilo-rest-api-docs/ilo5/#oem-hpe-poststate) property available in an `Oem.Hpe` Redfish sub-tree of HPE servers (Gen9 and Gen10) and providing a fine grained server state.

## HPE PostState

As mentioned in the [iLO 4](https://hewlettpackard.github.io/ilo-rest-api-docs/ilo4/#poststate) and [iLO 5](https://hewlettpackard.github.io/ilo-rest-api-docs/ilo5/#oem-hpe-poststate) API Reference documents, the `PostState` property can have the following values: `Null`, `Unknown`, `Reset`, `PowerOff`, `InPost`, `InPostDiscoveryComplete` and `FinishedPost`. Since the first four values have a straight forward meaning, we will only focus on the other ones.

The `InPost` value means that the server is still performing the Pre-OS Tasks (tests and hardware discovery). With a graphical console opened, when a server is in this state you can see a green progress bar:

![InPost state 1](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/1-InPost.png)

![InPost state 2](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/2-InPost.png)

`InPostDiscoveryComplete` follows the `InPost` state in the boot process of a server. For the purpose of this blog, we assume that it corresponds to the state in which UEFI is loaded and running:

![InPostDiscoveryComplete / UEFI](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/3-InPostDiscoveryComplete.png)

Note that when an UEFI executable is running (i.e. UEFI Shell, `grubx64.efi`...) the server stays in the `InPostDiscoveryComplete` state.

The last possible value for the `PostState` key is `FinishedPost`. In this state, the server is either booting an installed OS or has completely finished its boot process.

## `PostState` use cases

The first obvious use case for probing the `PostState` of a server or a set of servers is in a  monitoring application. Combined with the health status of the different components of the server, you will be able to draw dashboards or create reports.

In a server management and configuration context, several properties can only be modified when the server is in a particular state. For example, the boot order can only be modified in the `Off` or in the `FinishedPost` states (OS booted).

In the following screenshot we use [ilorest](http://hpe.com/info/resttool) to change the next boot entry of a server being in the `InPostDiscoveryComplete` state. In this case, the iLO returns a `[400]` error code with an explicit message.

![Boot Order cannot be changed when in POST](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/4-CannotChangeBootOrderWhenInPost.png)

In a Bios and/or storage controller configuration process, the `PostState` property plays a crucial role. As explained in [Setting Bios and Storage Controller Properties with Redfish](https://developer.hpe.com/blog/setting-bios-and-storage-controller-properties-with-redfish) this process is performed in two phases: 1 - parameter setup into a Redfish pending area. 2 - Reset / Cold Boot of the server to trigger a POST during which the new settings will be verified and transferred, if validated, from  the pending area into the active area.

When the modifications are not validated during the second phase a message explaining the problem can be retrieved once the server is in the `InPostDiscoveryComplete` or `FinishedPost` states.

Hence, as a best practice, it is wise to pool the managed nodes and check for possible error messages when they are in one of those states (`InPost` or `InPostDiscoveryComplete`).

## How do I retrieve the Server State

The easiest way to obtain the `PostState` of a server is to issue the `serverstate` macro command of the [ilorest](http://hpe.com/info/resttool) utility. `ilorest`  automatically detects the generation of the server (Gen9, Gen10...) and fetches the `PostState` value from the right Redfish path.

The [Open Source](https://github.com/HewlettPackard/python-redfish-utility) version of `ilorest` contains the source of this [`ServerState` macro command](https://github.com/HewlettPackard/python-redfish-utility/blob/master/src/extensions/iLO%20COMMANDS/ServerStateCommand.py) in python. Feel free to consult it.

![Retrieve `PostState` with `ilorest`](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/5-RetrieveServerStateWithIlorest.png)

If you decide to create your own application you will have to adapt your code to the potential Redfish [data model changes](https://hewlettpackard.github.io/ilo-rest-api-docs/ilo5/#ilo-5-data-model-changes) between the different generations of servers or iLOs.

As a concrete example, in an HPE rack mount server the `PostState` property has moved from `/redfish/v1/Systems/1/oem/hp` in Gen9 models to `/redfish/v1/Systems/1/oem/hpe` in Gen10s.

## The HPE Agentless Management Service is your friend

In the above `PostState` paragraph, we learned that the `FinishedPost` state corresponds to both a system booting an OS and a system with the OS ready to be used.

What if the system is stuck in the boot process and never reaches the target level required for being fully operational? How your monitoring or management application can detect this kind of embarrassing situation?

There are multiples ways to solve this problem, including the use of `ping`, `ssh` or SNMP queries to the host OS. However, this is not always possible or desired.

An alternative is using the [HPE Agentless Management Service (AMS)](https://www.hpe.com/us/en/product-catalog/detail/pip.5219980.html) combined to Redfish.

The AMS is a very high level service running in a bare-metal Operating System and communicating with the iLO through an internal path (CHIF driver over PCIe bus). Among other things, it communicates the OS hostname to the iLO which stores it in the `HostName` property of the `/redfish/v1/Systems/{item}` sub-tree.

By setting this resource to a null or known string when the server is `Off`, and then by polling it regularly during the boot process you can detect its change and conclude with a small risk of error that the OS is running fine.

It is mandatory to initialize the `HostName` property before the OS deployment or boot process because once set, Redfish caches it to make it persistent across reboots. Perform this configuration with an HTTP PATCH toward `/redfish/v1/Systems/{item}/` and a payload similar to: `{"HostName": ""}`

Note that this resource can only be modified when the system is `Off` or in `FinishedPost` state. Said differently it cannot be modified in `InPost` or `InPostDiscoveryComplete` states. This gives the assurance that only a limited number of entities can modify it: An end-user through the iLO GUI, the Redfish API and the Operating System.

In summary, the deployment process of a bare-metal server could be written as:


```Pseudo Code
Set server in `Off` state
set `HostName` to a null or a well-known string different from the final OS hostname
Configure other needed parameters including OS deployment bootstraps

Set Server On
While HostName not equal to final OS hostname and Timeout not reached ; do
    Get HostName
done
```

**Restriction**: The configuration of the `HostName` property using Redfish on **Gen9** servers is possible with firmware 2.60 or later.

## The `DeviceDiscoveryComplete` collection

In addition to the `PowerState` and `PostState` properties, the `DeviceDiscoveryComplete` collection returns the discovery state of the AMS, SmartArrays (if any) and a third generic state for all other devices.

It may happen during startup that a system returns `InPostDiscoveryComplete` while not all of its devices have been discovered.

The following script polls every other second the `PostState` and the `DeviceDiscoveryComplete` properties:


```bash
let i=1
while [ 1 ] ; do
    echo $i
    $CURL --silent --insecure -u ${ILO_USER}:${ILO_PASSWD}   \
        --request GET                                        \
        -H "OData-Version: 4.0"                              \
        https://${ILO_IP}/redfish/v1/Systems/1/              \
        | jq -r '.Oem.Hpe.PostState, .Oem.Hpe.DeviceDiscoveryComplete'
    sleep 2
    let i++
    echo
done
```

The following picture shows three iterations of the the script during the start of a server. In iteration 55 the server is `InPost` while the SmartArray is in a `Cached` state meaning that it will answer queries with cached data.

Two seconds later the next iteration returns the `InPostDiscoveryComplete` state and shows the SmartArray in `Busy` mode which means that it will return an error if queried during this state.

In iteration 62 we are still in `InPostDiscoveryComplete` but both `DeviceDiscovery` and `SmartArrayDiscovery` have reached their final `Complete` state. Hence the the corresponding devices can be queried safely.

![The `DeviceDiscoveryComplete` collection](https://redfish-lab.sourceforge.io/media/redfish-wiki/Master-the-Redfish-Server-States/6-DeviceDiscoveryComplete.png)


## Conclusion

Combining the `PowerState` Redfish property with specific HPE features like the `PostState`, `DeviceDiscoveryComplete` and the Agentless Management Service, you will be able to increase the efficiency of your monitoring and management applications.

HPE provides as well a rich Redfish ecosystem including the free [`ilorest` tool](https://hpe.com/info/resttool), its [Open Source](https://github.com/HewlettPackard/python-redfish-utility) version and a [Python library](https://github.com/HewlettPackard/python-ilorest-library). PowerShell developers have the possibility to use a set of specific Redfish [Cmdlets](https://www.powershellgallery.com/packages/HPRESTCmdlets/) required to run the [GitHub ProLiant SDK](https://github.com/HewlettPackard/PowerShell-ProLiant-SDK).

In addition to the above, technical [Redfish videos](https://www.youtube.com/channel/UCIZhrIYcNh3wHLiY4ola5ew/search?query=redfish) can help you learning more on this new way for managing servers.