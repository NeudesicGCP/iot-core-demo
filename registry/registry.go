// Copyright 2017 Neudesic. All rights reserved.
// Use of this source code is governed by MIT license that can be found in the
// LICENSE file.

package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	iot "google.golang.org/api/cloudiot/v1"
	"google.golang.org/appengine/log"
	"google.golang.org/appengine/urlfetch"
)

const (
	// Used when constructing the device REST path; provides the host to use for URLs
	CLOUD_IOT_BASE_URL = "https://cloudiotdevice.googleapis.com"

	// Used when constructing the device resource path; should match
	// the version imported above
	CLOUD_IOT_API_VERSION = "v1"

	// Load device expiration from environment, but have a sane default
	REGISTRY_EXPIRATION_ENV_NAME      = "REGISTRATION_SERVICE_REGISTRY_EXPIRATION"
	REGISTRY_EXPIRATION_DEFAULT_VALUE = "720h"
)

var (
	// If non-zero, when creating an entry for the device in registry an
	// expiration will be calculated and used based on current time and
	// this duration.
	registryExpiration time.Duration
)

func init() {
	exp, err := time.ParseDuration(getEnvOrDefault(REGISTRY_EXPIRATION_ENV_NAME, REGISTRY_EXPIRATION_DEFAULT_VALUE))
	if err != nil {
		exp, err = time.ParseDuration(REGISTRY_EXPIRATION_DEFAULT_VALUE)
	}
	registryExpiration = exp
}

// Creates a parent string for the device
func deviceParentString() string {
	return fmt.Sprintf("projects/%s/locations/%s/registries/%s", ProjectId, LocationId, RegistryId)
}

// Creates a new entry in device registry for the named device, and returns the
// unigue resource path that should be used by the device for communication
func registerDevice(ctx context.Context, name string, cert []byte) (path string, err error) {
	pubKey := &iot.PublicKeyCredential{
		Format: "RSA_X509_PEM",
		Key:    string(cert),
	}
	credential := &iot.DeviceCredential{
		PublicKey: pubKey,
	}
	if registryExpiration != 0 {
		exp := time.Now().Add(registryExpiration).UTC().Format(time.RFC3339Nano)
		credential.ExpirationTime = exp
	}
	device := &iot.Device{
		Id:          name,
		Credentials: []*iot.DeviceCredential{credential},
	}
	transport := &oauth2.Transport{
		Source: google.AppEngineTokenSource(ctx, iot.CloudiotScope),
		Base:   &urlfetch.Transport{Context: ctx},
	}
	client := &http.Client{Transport: transport}
	var svc *iot.Service
	svc, err = iot.New(client)
	if err != nil {
		log.Errorf(ctx, "Unable to create new service instance: %v", err)
		return
	}
	device, err = svc.Projects.Locations.Registries.Devices.Create(deviceParentString(), device).Do()
	if err != nil {
		log.Errorf(ctx, "Error returned from Device Create method: %v", err)
		return
	}
	path = fmt.Sprintf("%s/%s/%s", CLOUD_IOT_BASE_URL, CLOUD_IOT_API_VERSION, device.Name)
	log.Debugf(ctx, "Device created: %s", path)
	return
}
